import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_community_reward_summary");
  if (error) {
    console.error("reward summary failed", error);
    return NextResponse.json({ error: "rewards_unavailable" }, { status: 500 });
  }

  const summary = data?.[0] ?? {
    points: 0,
    verified_contributions: 0,
    trust_score: 0,
    trust_level: "new",
  };

  return NextResponse.json({
    data: {
      points: Number(summary.points ?? 0),
      verifiedContributions: Number(summary.verified_contributions ?? 0),
      trustScore: Number(summary.trust_score ?? 0),
      trustLevel: summary.trust_level ?? "new",
    },
    meta: { source: "verified_community_reward_ledger" },
  });
}
