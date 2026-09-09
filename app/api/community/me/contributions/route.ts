import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("community_price_submissions")
    .select("id, product_id, retailer_id, store_branch_id, observed_price, currency, observed_at, verification_status, verified_at, verification_reason, created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("community contribution history failed", error);
    return NextResponse.json({ error: "community_history_unavailable" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
