import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validation/commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const { data, error } = await supabase.from("orders").select("id,status,currency,subtotal,delivery_fee,total,created_at,updated_at,order_items(id,product_id,product_name,quantity,unit_price,line_total),fulfilments(id,method,status,tracking_reference)").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "orders_fetch_failed" }, { status: 503 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_checkout", details: parsed.error.flatten() }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const { data: basket, error: basketError } = await supabase.from("baskets").select("id,retailer_id,branch_id,status,basket_items(id,product_id,special_id,quantity,unit_price,products(name))").eq("id", parsed.data.basket_id).eq("user_id", user.id).single();
  if (basketError || !basket || basket.status !== "open") return NextResponse.json({ error: "basket_not_checkoutable" }, { status: 409 });
  const items = basket.basket_items ?? [];
  if (!items.length) return NextResponse.json({ error: "basket_empty" }, { status: 409 });
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price ?? 0), 0);
  const { data: order, error } = await supabase.from("orders").insert({ user_id: user.id, basket_id: basket.id, retailer_id: basket.retailer_id, branch_id: basket.branch_id, subtotal, total: subtotal }).select("id,status,currency,subtotal,delivery_fee,total,created_at").single();
  if (error) return NextResponse.json({ error: "order_create_failed" }, { status: 503 });
  const rows = items.map((item) => ({ order_id: order.id, product_id: item.product_id, special_id: item.special_id, product_name: item.products?.name ?? "Product", quantity: item.quantity, unit_price: Number(item.unit_price ?? 0), line_total: Number(item.quantity) * Number(item.unit_price ?? 0) }));
  const itemInsert = await supabase.from("order_items").insert(rows);
  if (itemInsert.error) return NextResponse.json({ error: "order_items_create_failed" }, { status: 503 });
  return NextResponse.json({ data: order, payment: { provider: "payfast", status: "pending", return_url: parsed.data.return_url ?? null } }, { status: 201 });
}
