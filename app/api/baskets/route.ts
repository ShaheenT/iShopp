import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { basketItemSchema } from "@/lib/validation/commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const { data, error } = await supabase.from("baskets").select("id,retailer_id,branch_id,status,currency,created_at,updated_at,basket_items(id,product_id,special_id,quantity,unit_price,products(id,name,brand,image_url,unit_text))").eq("user_id", user.id).eq("status", "open").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "basket_fetch_failed" }, { status: 503 });
  return NextResponse.json({ data: data ?? null });
}

export async function POST(request: NextRequest) {
  const parsed = basketItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_basket_item", details: parsed.error.flatten() }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  let { data: basket } = await supabase.from("baskets").select("id").eq("user_id", user.id).eq("status", "open").maybeSingle();
  if (!basket) {
    const created = await supabase.from("baskets").insert({ user_id: user.id }).select("id").single();
    if (created.error) return NextResponse.json({ error: "basket_create_failed" }, { status: 503 });
    basket = created.data;
  }
  const { data, error } = await supabase.from("basket_items").upsert({ basket_id: basket.id, ...parsed.data }, { onConflict: "basket_id,product_id,special_id" }).select("id,basket_id,product_id,special_id,quantity,unit_price").single();
  if (error) return NextResponse.json({ error: "basket_item_upsert_failed" }, { status: 503 });
  return NextResponse.json({ data }, { status: 201 });
}
