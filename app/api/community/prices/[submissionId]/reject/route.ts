import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const submissionIdSchema = z.string().uuid();
const bodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  if (!submissionIdSchema.safeParse(submissionId).success) {
    return NextResponse.json({ error: "invalid_submission_id" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_rejection_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("reject_community_price", {
    p_submission_id: submissionId,
    p_reason: parsedBody.data.reason,
  });

  if (error) {
    console.error("community price rejection failed", error);
    const status = error.message.includes("access denied") ? 403 : error.message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: "community_price_rejection_failed" }, { status });
  }

  return NextResponse.json({ data: data?.[0] ?? null });
}
