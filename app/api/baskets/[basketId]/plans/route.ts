import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  if (!idSchema.safeParse(basketId).success) return NextResponse.json({ error: "invalid_basket_id" }, { status: 400 });
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("shopping_plans")
    .select("id,basket_id,total_product_cost,delivery_fees,store_visit_cost,total_landed_cost,currency,status,created_at,expires_at,shopping_plan_items(id,product_id,retailer_id,store_branch_id,special_id,fulfilment_rule_id,quantity,unit_price,line_total,currency)")
    .eq("basket_id", basketId)
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "shopping_plans_unavailable" }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
