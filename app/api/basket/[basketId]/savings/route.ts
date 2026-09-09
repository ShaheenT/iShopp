import { NextResponse } from "next/server";
import { z } from "zod";

import { optimizeSavings } from "@/lib/basket/savings-optimization";
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
    branch_id: string | null;
    branch_name: string | null;
    special_id: string;
    special_price: number;
    currency: string;
  }>;

  if (rows.length === 0) {
    return NextResponse.json({
      data: {
        basketId,
        baselineCost: 0,
        optimizedCost: 0,
        savings: 0,
        savingsPercent: 0,
        currency: "ZAR",
        verified: true,
        baseline: "lowest verified single-retailer basket",
      },
    });
  }

  const currencies = new Set(rows.map((row) => row.currency));
  if (currencies.size !== 1) {
    return NextResponse.json({ error: "mixed_basket_currencies" }, { status: 409 });
  }

  const currency = rows[0].currency;
  const items = [...new Map(rows.map((row) => [row.product_id, { productId: row.product_id, quantity: row.quantity }])).values()];
  const offers = rows.map((row) => ({
    productId: row.product_id,
    retailerId: row.retailer_id,
    retailerName: row.retailer_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    specialId: row.special_id,
    unitPrice: Number(row.special_price),
    currency: row.currency,
  }));

  // A defensible savings claim needs a real baseline. We use the lowest verified
  // complete basket available from one retailer, then compare it with the lowest
  // verified product-price allocation across up to two retailers. No invented MSRP
  // or stale "current price" is used.
  const baseline = optimizeSavings(items, offers, { maxStores: 1, storeVisitCost: 0 });
  const optimized = optimizeSavings(items, offers, { maxStores: 2, storeVisitCost: 0 });

  if (!baseline || !optimized) {
    return NextResponse.json({
      data: {
        basketId,
        baselineCost: null,
        optimizedCost: null,
        savings: 0,
        savingsPercent: 0,
        currency,
        verified: true,
        baseline: "lowest verified single-retailer basket",
        unavailable: true,
      },
    });
  }

  const savings = Number(Math.max(0, baseline.totalProductCost - optimized.totalProductCost).toFixed(2));
  const savingsPercent = baseline.totalProductCost === 0
    ? 0
    : Number(((savings / baseline.totalProductCost) * 100).toFixed(2));

  return NextResponse.json({
    data: {
      basketId,
      baselineCost: baseline.totalProductCost,
      optimizedCost: optimized.totalProductCost,
      savings,
      savingsPercent,
      currency,
      verified: true,
      baseline: "lowest verified single-retailer basket",
      baselineRetailerCount: baseline.retailerCount,
      optimizedRetailerCount: optimized.retailerCount,
    },
  });
}
