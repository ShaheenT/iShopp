import { NextResponse } from "next/server";
import { z } from "zod";

import { calculateBasketSavings } from "@/lib/basket/savings-summary";
import { createClient } from "@/lib/supabase/server";

const basketIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ basketId: string }> },
) {
  const { basketId } = await params;
  if (!basketIdSchema.safeParse(basketId).success) {
    return NextResponse.json({ error: "invalid_basket_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_basket_intelligence_inputs", {
    p_basket_id: basketId,
  });
  if (error) {
    console.error("basket savings lookup failed", error);
    return NextResponse.json({ error: "basket_savings_lookup_failed" }, { status: 400 });
  }

  const rows = (data ?? []) as Array<{
    product_id: string;
    quantity: number;
    retailer_id: string;
    retailer_name: string;
    special_price: number;
    currency: string;
  }>;

  if (rows.length === 0) {
    return NextResponse.json({
      data: {
        basketId,
        currentCost: 0,
        optimizedCost: 0,
        savings: 0,
        savingsPercent: 0,
        currency: "ZAR",
        verified: true,
      },
    });
  }

  const currencies = new Set(rows.map((row) => row.currency));
  if (currencies.size !== 1) {
    return NextResponse.json({ error: "mixed_basket_currencies" }, { status: 409 });
  }

  const currency = rows[0].currency;
  const summary = calculateBasketSavings(
    rows.map((row) => ({
      productId: row.product_id,
      retailerId: row.retailer_id,
      retailerName: row.retailer_name,
      price: Number(row.special_price),
      currency: row.currency,
      quantity: row.quantity,
    })),
    currency,
  );

  return NextResponse.json({ data: { basketId, ...summary, verified: true } });
}
