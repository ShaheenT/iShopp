import { NextResponse } from "next/server";
import { z } from "zod";

import { optimizeFulfilment, type FulfilmentRule } from "@/lib/basket/fulfilment-optimization";
import type { SavingsItem, SavingsOffer } from "@/lib/basket/savings-optimization";
import { createClient } from "@/lib/supabase/server";

const basketIdSchema = z.string().uuid();
const idempotencyKeySchema = z.string().uuid();
const bodySchema = z.object({
  maxStores: z.number().int().min(1).max(5).default(2),
  storeVisitCost: z.number().finite().min(0).max(1000).default(0),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  if (!basketIdSchema.safeParse(basketId).success) return NextResponse.json({ error: "invalid_basket_id" }, { status: 400 });

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) {
    return NextResponse.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) return NextResponse.json({ error: "invalid_plan_parameters" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: existingPlan, error: existingPlanError } = await supabase
    .from("shopping_plans")
    .select("id, basket_id, expires_at")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingPlanError) return NextResponse.json({ error: "shopping_plan_lookup_failed" }, { status: 500 });
  if (existingPlan && existingPlan.basket_id !== basketId) {
    return NextResponse.json({ error: "idempotency_key_reused" }, { status: 409 });
  }
  const idempotentRetry = Boolean(existingPlan);

  const { data: basketItems, error: basketError } = await supabase
    .from("shopping_basket_items")
    .select("product_id, quantity, shopping_baskets!inner(user_id)")
    .eq("basket_id", basketId)
    .eq("shopping_baskets.user_id", userData.user.id);
  if (basketError) return NextResponse.json({ error: "basket_unavailable" }, { status: 500 });

  const items: SavingsItem[] = (basketItems ?? []).map((item) => ({ productId: item.product_id, quantity: item.quantity }));
  const { data: inputs, error: inputError } = await supabase.rpc("get_basket_intelligence_inputs", { p_basket_id: basketId });
  if (inputError) return NextResponse.json({ error: "basket_optimization_unavailable" }, { status: 500 });

  const offers: SavingsOffer[] = (inputs ?? []).map((row) => ({
    productId: row.product_id,
    retailerId: row.retailer_id,
    retailerName: row.retailer_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    specialId: row.special_id,
    unitPrice: Number(row.special_price),
    currency: row.currency,
  }));

  const { data: fulfilmentInputs, error: fulfilmentError } = await supabase.rpc("get_basket_fulfilment_inputs", { p_basket_id: basketId });
  if (fulfilmentError) return NextResponse.json({ error: "fulfilment_rules_unavailable" }, { status: 500 });

  const rules: FulfilmentRule[] = (fulfilmentInputs ?? []).map((row) => ({
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

  const planItems = result.allocations.map((item) => {
    const exactRule = rules.find((rule) => rule.retailerId === item.retailerId && rule.branchId === item.branchId);
    const fallbackRule = rules.find((rule) => rule.retailerId === item.retailerId && rule.branchId == null);
    return {
      productId: item.productId,
      retailerId: item.retailerId,
      branchId: item.branchId ?? null,
      specialId: item.specialId,
      fulfilmentRuleId: exactRule?.fulfilmentRuleId ?? fallbackRule?.fulfilmentRuleId ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      currency: item.currency,
    };
  });

  if (planItems.some((item) => !item.fulfilmentRuleId)) return NextResponse.json({ error: "verified_fulfilment_rule_missing" }, { status: 409 });

  const { data: plan, error: planError } = await supabase.rpc("create_verified_shopping_plan", {
    p_basket_id: basketId,
    p_total_product_cost: result.totalProductCost,
    p_delivery_fees: result.deliveryFees,
    p_store_visit_cost: result.storeVisitCost,
    p_total_landed_cost: result.totalLandedCost,
    p_currency: result.allocations[0]?.currency ?? "ZAR",
    p_items: planItems,
    p_idempotency_key: idempotencyKey,
  });
  if (planError) {
    console.error("shopping plan creation failed", planError);
    return NextResponse.json({ error: "shopping_plan_creation_failed" }, { status: 409 });
  }

  return NextResponse.json({
    data: { ...result, planId: plan?.[0]?.plan_id ?? null, expiresAt: plan?.[0]?.expires_at ?? null },
    meta: { basketId, commercialPricing: "verified", source: "verified_specials_and_fulfilment_rules", idempotent: idempotentRetry },
  }, { status: idempotentRetry ? 200 : 201 });
}
