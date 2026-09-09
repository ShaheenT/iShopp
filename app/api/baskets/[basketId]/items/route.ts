import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const itemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(999) });
export const dynamic = "force-dynamic";

async function getBasket(basketId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { supabase, user: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!idSchema.safeParse(basketId).success) return { supabase, user: userData.user, response: NextResponse.json({ error: "invalid_basket_id" }, { status: 400 }) };
  const { data: basket, error } = await supabase.from("shopping_baskets").select("id").eq("id", basketId).eq("user_id", userData.user.id).maybeSingle();
  if (error) return { supabase, user: userData.user, response: NextResponse.json({ error: "basket_unavailable" }, { status: 500 }) };
  if (!basket) return { supabase, user: userData.user, response: NextResponse.json({ error: "basket_not_found" }, { status: 404 }) };
  return { supabase, user: userData.user, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const auth = await getBasket(basketId);
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.from("shopping_basket_items").select("id,product_id,quantity,created_at,updated_at,products(id,name,brand,unit,image_url)").eq("basket_id", basketId).order("created_at");
  if (error) return NextResponse.json({ error: "basket_items_unavailable" }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const auth = await getBasket(basketId);
  if (auth.response) return auth.response;
  const parsed = itemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_basket_item" }, { status: 400 });
  const { data: product, error: productError } = await auth.supabase.from("products").select("id").eq("id", parsed.data.productId).eq("verification_status", "verified").maybeSingle();
  if (productError) return NextResponse.json({ error: "product_lookup_failed" }, { status: 500 });
  if (!product) return NextResponse.json({ error: "verified_product_not_found" }, { status: 404 });
  const { data, error } = await auth.supabase.from("shopping_basket_items").upsert({ basket_id: basketId, product_id: parsed.data.productId, quantity: parsed.data.quantity, updated_at: new Date().toISOString() }, { onConflict: "basket_id,product_id" }).select("id,product_id,quantity,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "basket_item_save_failed" }, { status: 500 });
  await auth.supabase.from("shopping_baskets").update({ updated_at: new Date().toISOString() }).eq("id", basketId).eq("user_id", auth.user!.id);
  return NextResponse.json({ data }, { status: 201 });
}
