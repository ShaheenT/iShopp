import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const configuredToken = process.env.ISHOPP_INGESTION_API_TOKEN;
  const suppliedToken = request.headers.get("x-ishopp-ingestion-token");

  if (configuredToken && suppliedToken && suppliedToken === configuredToken) {
    return true;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.role === "admin";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_candidate_id" }, { status: 400 });
  }

  let reason = "rejected_by_reviewer";
  try {
    const body = await request.json();
    if (body?.reason !== undefined) {
      if (typeof body.reason !== "string" || body.reason.length > 2000) {
        return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
      }
      reason = body.reason;
    }
  } catch {
    // An empty request body uses the default rejection reason.
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("special_candidates")
    .update({
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id,status,rejection_reason,updated_at")
    .maybeSingle();

  if (error) {
    console.error("special candidate rejection failed", error);
    return NextResponse.json({ error: "special_candidate_rejection_failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "special_candidate_not_pending" }, { status: 409 });
  }

  return NextResponse.json({ data });
}
