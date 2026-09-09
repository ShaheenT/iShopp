import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const ruleIdSchema = z.string().uuid();
const bodySchema = z.object({ reason: z.string().trim().min(1).max(2000).default("Verified against submitted evidence") });

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  if (!ruleIdSchema.safeParse(ruleId).success) return NextResponse.json({ error: "invalid_rule_id" }, { status: 400 });

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) return NextResponse.json({ error: "invalid_verification_request" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("verify_fulfilment_rule", {
    p_rule_id: ruleId,
    p_reason: parsedBody.data.reason,
  });

  if (error) {
    console.error("fulfilment verification failed", error);
    const status = error.message.includes("access denied") ? 403 : error.message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: "fulfilment_verification_failed" }, { status });
  }

  return NextResponse.json({ data: data?.[0] ?? null });
}
