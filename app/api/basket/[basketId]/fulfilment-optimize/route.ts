import { NextResponse } from "next/server";
import { z } from "zod";

import { optimizeFulfilment, type FulfilmentRule } from "@/lib/basket/fulfilment-optimization";
import type { SavingsItem, SavingsOffer } from "@/lib/basket/savings-optimization";
import { createClient } from "@/lib/supabase/server";

const basketIdSchema = z.string().uuid();
const bodySchema = z.object({
  maxStores: z.number().int().min(1).max(5).default(2),
  storeVisitCost: z.number().finite().min(0).max(1000).default(0),
});

type IntelligenceInputRow = {
  product_id: string;
  retailer_id: string;
  retailer_name: string;
  branch_id: string | null;
  branch_name: string | null;
  special_id: string;
  special_price: number | string;
  currency: string;
};

type FulfilmentInputRow = {
  retailer_id: string;
  branch_id: string | null;
  fulfilment_mode: FulfilmentRule["fulfilmentMode"];
  is_available: boolean;
  delivery_fee: number | string;
  minimum_order_value: number | string | null;
  currency: string;
  fulfilment_rule_id: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const parsedBasketId = basketIdSchema.safeParse(basketId);
  if (!parsedBasketId.success) return NextResponse.json({ error: "invalid_basket_id" }, { status: 400 });

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "invalid_fulfilment_parameters" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: basketItems, error: basketError } = await supabase
    .from("shopping_basket_items")
    .select("product_id, quantity, shopping_baskets!inner(user_id)")
    .eq("basket_id", parsedBasketId.data)
    .eq("shopping_baskets.user_id", userData.user.id);
  if (basketError) {
    console.error("fulfilment optimization items failed", basketError);
    return NextResponse.json({ error: "basket_unavailable" }, { status: 500 });
  }

  const items: SavingsItem[] = (basketItems ?? []).map((item) => ({ productId: item.product_id, quantity: item.quantity }));
  const { data: inputs, error: inputError } = await supabase.rpc("get_basket_intelligence_inputs", { p_basket_id: parsedBasketId.data });
  if (inputError) {
    console.error("fulfilment optimization offer RPC failed", inputError);
    return NextResponse.json({ error: "basket_optimization_unavailable" }, { status: 500 });
  }

  const offers: SavingsOffer[] = (inputs as IntelligenceInputRow[] | null ?? []).map((row) => ({
    productId: row.product_id,
    retailerId: row.retailer_id,
    retailerName: row.retailer_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    specialId: row.special_id,
    unitPrice: Number(row.special_price),
    currency: row.currency,
  }));

  const { data: fulfilmentInputs, error: fulfilmentError } = await supabase.rpc("get_basket_fulfilment_inputs", { p_basket_id: parsedBasketId.data });
  if (fulfilmentError) {
    console.error("fulfilment rules RPC failed", fulfilmentError);
    return NextResponse.json({ error: "fulfilment_rules_unavailable" }, { status: 500 });
  }

  const rules: FulfilmentRule[] = (fulfilmentInputs as FulfilmentInputRow[] | null ?? []).map((row) => ({
    retailerId: row.retailer_id,
    branchId: row.branch_id,
    fulfilmentMode: row.fulfilment_mode,
    isAvailable: row.is_available,
    deliveryFee: Number(row.delivery_fee),
    minimumOrderValue: row.minimum_order_value == null ? null : Number(row.minimum_order_value),
    currency: row.currency,
    fulfilmentRuleId: row.fulfilment_rule_id,
  }));

  const result = optimizeFulfilment(items, offers, rules, parsedBody.data);
  if (!result) return NextResponse.json({ error: "basket_not_fully_available" }, { status: 409 });

  return NextResponse.json({
    data: result,
    meta: {
      basketId: parsedBasketId.data,
      maxStores: parsedBody.data.maxStores,
      storeVisitCost: parsedBody.data.storeVisitCost,
      fulfilmentPricingMode: "verified",
      fulfilmentRulesSource: "supabase_verified_effective_rules",
    },
  });
}
