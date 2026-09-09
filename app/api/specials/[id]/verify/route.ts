import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const verificationSchema = z.object({
  action: z.enum(["verified", "rejected"]),
  evidenceId: z.string().uuid().optional(),
  reason: z.string().trim().max(2000).optional(),
});

async function getAuthorizedUser(request: Request) {
  const configuredToken = process.env.ISHOPP_INGESTION_API_TOKEN;
  const suppliedToken = request.headers.get("x-ishopp-ingestion-token");

  if (configuredToken && suppliedToken && suppliedToken === configuredToken) {
    return { id: null, authorized: true };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return {
    id: user?.id ?? null,
    authorized: user?.app_metadata?.role === "admin",
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await getAuthorizedUser(request);
  if (!actor.authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_special_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = verificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_verification", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: special, error: specialError } = await admin
    .from("specials")
    .select("id,verification_status")
    .eq("id", id)
    .maybeSingle();

  if (specialError) {
    console.error("verification special lookup failed", specialError);
    return NextResponse.json({ error: "special_unavailable" }, { status: 500 });
  }
  if (!special) {
    return NextResponse.json({ error: "special_not_found" }, { status: 404 });
  }
  if (special.verification_status === "verified") {
    return NextResponse.json({ error: "special_already_verified" }, { status: 409 });
  }

  const { action, evidenceId, reason } = parsed.data;

  if (action === "verified") {
    if (!evidenceId) {
      return NextResponse.json({ error: "evidence_required_for_verification" }, { status: 422 });
    }

    const { data: evidence, error: evidenceError } = await admin
      .from("special_evidence")
      .select("id,special_id,status")
      .eq("id", evidenceId)
      .eq("special_id", id)
      .maybeSingle();

    if (evidenceError) {
      console.error("verification evidence lookup failed", evidenceError);
      return NextResponse.json({ error: "evidence_unavailable" }, { status: 500 });
    }
    if (!evidence) {
      return NextResponse.json({ error: "evidence_not_found" }, { status: 404 });
    }
    if (evidence.status === "failed") {
      return NextResponse.json({ error: "invalid_evidence" }, { status: 422 });
    }
  }

  const nextStatus = action === "verified" ? "verified" : "rejected";
  const { data: updated, error: updateError } = await admin
    .from("specials")
    .update({
      verification_status: nextStatus,
      verified_at: action === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("verification_status", special.verification_status)
    .select("id,verification_status,verified_at,updated_at")
    .maybeSingle();

  if (updateError) {
    console.error("special verification update failed", updateError);
    return NextResponse.json({ error: "verification_failed" }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "verification_conflict" }, { status: 409 });
  }

  const { error: auditError } = await admin
    .from("special_verification_events")
    .insert({
      special_id: id,
      action,
      previous_status: special.verification_status,
      new_status: nextStatus,
      actor_user_id: actor.id,
      reason: reason ?? null,
      evidence_id: evidenceId ?? null,
    });

  if (auditError) {
    console.error("verification audit failed", auditError);
    return NextResponse.json({ error: "verification_audit_failed" }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
