import { NextResponse } from "next/server";
import { z } from "zod";

import { calculateBasketIntelligence, type BasketItem, type BasketOffer } from "@/lib/basket/basket-intelligence";
import { createClient } from "@/lib/supabase/server";

const basketIdSchema = z.string().uuid();
const maxStoresSchema = z.coerce.number().int().min(1).max(5).default(2);

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ basketId: string }> },
) {
  const { basketId } = await params;
  const parsedBasketId = basketIdSchema.safeParse(basketId);
  if (!parsedBasketId.success) {
    return NextResponse.json({ error: "invalid_basket_id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedMaxStores = maxStoresSchema.safeParse(url.searchParams.get("maxStores") ?? "2");
  if (!parsedMaxStores.success) {
    return NextResponse.json({ error: "invalid_max_stores" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: basketItems, error: basketError } = await supabase
    .from("shopping_basket_items")
    .select("product_id, quantity, shopping_baskets!inner(user_id)")
    .eq("basket_id", parsedBasketId.data)
    .eq("shopping_baskets.user_id", userData.user.id);

  if (basketError) {
    console.error("basket items GET failed", basketError);
    return NextResponse.json({ error: "basket_unavailable" }, { status: 500 });
  }

  const items: BasketItem[] = (basketItems ?? []).map((item) => ({
    productId: item.product_id,
    quantity: item.quantity,
  }));

  const { data: inputs, error: intelligenceError } = await supabase.rpc("get_basket_intelligence_inputs", {
    p_basket_id: parsedBasketId.data,
  });

  if (intelligenceError) {
    console.error("basket intelligence RPC failed", intelligenceError);
    return NextResponse.json({ error: "basket_intelligence_unavailable" }, { status: 500 });
  }

  const offers: BasketOffer[] = (inputs ?? []).map((row) => ({
    productId: row.product_id,
    retailerId: row.retailer_id,
    retailerName: row.retailer_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    specialId: row.special_id,
    specialPrice: Number(row.special_price),
    currency: row.currency,
  }));

  const intelligence = calculateBasketIntelligence(items, offers, parsedMaxStores.data);

  return NextResponse.json({
    data: intelligence,
    meta: {
      basketId: parsedBasketId.data,
      maxStores: parsedMaxStores.data,
    },
  });
}
