import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const submissionIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  if (!submissionIdSchema.safeParse(submissionId).success) {
    return NextResponse.json({ error: "invalid_submission_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_community_price_risk", {
    p_submission_id: submissionId,
  });

  if (error) {
    console.error("community price risk assessment failed", error);
    const status = error.message.includes("access denied") ? 403 : error.message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: "community_price_risk_unavailable" }, { status });
  }

  return NextResponse.json({ data: data?.[0] ?? null });
}
