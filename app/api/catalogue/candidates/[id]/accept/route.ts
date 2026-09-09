import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getActor(request: Request) {
  const configuredToken = process.env.ISHOPP_INGESTION_API_TOKEN;
  const suppliedToken = request.headers.get("x-ishopp-ingestion-token");

  if (configuredToken && suppliedToken && suppliedToken === configuredToken) {
    return { authorized: true, userId: null as string | null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.app_metadata?.role === "admin") {
    return { authorized: true, userId: user.id };
  }

  return { authorized: false, userId: null as string | null };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await getActor(request);
  if (!actor.authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_candidate_id" }, { status: 400 });
  }

  let reason: string | null = null;
  try {
    const body = await request.json();
    if (body?.reason !== undefined) {
      if (typeof body.reason !== "string" || body.reason.length > 2000) {
        return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
      }
      reason = body.reason;
    }
  } catch {
    // An empty request body is valid; reason is optional.
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("accept_special_candidate", {
    p_candidate_id: id,
    p_actor_user_id: actor.userId,
    p_reason: reason,
  });

  if (error) {
    const statusByCode: Record<string, number> = {
      P0010: 404,
      P0011: 409,
      P0012: 422,
      P0013: 422,
      P0014: 422,
      P0015: 422,
      P0016: 404,
    };

    return NextResponse.json(
      { error: error.message },
      { status: statusByCode[error.code ?? ""] ?? 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
