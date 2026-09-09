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

  const { action, evidenceId, reason } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_special", {
    p_special_id: id,
    p_action: action,
    p_evidence_id: evidenceId ?? null,
    p_actor_user_id: actor.id,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error("special verification failed", error);
    const statusByCode: Record<string, number> = {
      P0002: 404,
      P0003: 409,
      P0004: 422,
      P0005: 404,
      P0006: 422,
    };
    const status = statusByCode[error.code ?? ""] ?? 500;
    const errorByCode: Record<string, string> = {
      P0002: "special_not_found",
      P0003: "special_already_verified",
      P0004: "evidence_required_for_verification",
      P0005: "evidence_not_found",
      P0006: "invalid_evidence",
    };
    return NextResponse.json(
      { error: errorByCode[error.code ?? ""] ?? "verification_failed" },
      { status },
    );
  }

  return NextResponse.json({ data });
}
