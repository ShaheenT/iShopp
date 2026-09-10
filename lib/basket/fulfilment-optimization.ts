import type { SavingsItem, SavingsOffer } from './savings-optimization';

export type FulfilmentRule = {
  retailerId: string;
  branchId?: string | null;
  fulfilmentMode: 'delivery' | 'pickup' | 'collection';
  isAvailable: boolean;
  deliveryFee: number;
  minimumOrderValue?: number | null;
  currency: string;
  fulfilmentRuleId?: string;
};

export type FulfilmentOptimization = {
  totalProductCost: number;
  deliveryFees: number;
  storeVisitCost: number;
  minimumOrderSurcharges: number;
  totalLandedCost: number;
  retailerCount: number;
  allocations: Array<SavingsItem & SavingsOffer & { lineTotal: number }>;
  retailerSubtotals: Array<{
    retailerId: string;
    retailerName: string;
    subtotal: number;
    deliveryFee: number;
    storeVisitCost: number;
    minimumOrder: number;
    minimumOrderSurcharge: number;
    landedSubtotal: number;
  }>;
};

type FulfilmentCandidate = {
  allocations: FulfilmentOptimization['allocations'];
  productCost: number;
  retailers: string[];
  landedCost: number;
  fees: number;
  surcharges: number;
};

const round = (value: number) => Number(value.toFixed(2));

function ruleKey(retailerId: string, branchId?: string | null) {
  return `${retailerId}:${branchId ?? 'retailer'}`;
}

export function optimizeFulfilment(
  items: SavingsItem[],
  offers: SavingsOffer[],
  rules: FulfilmentRule[] = [],
  options: { maxStores?: number; storeVisitCost?: number } = {},
): FulfilmentOptimization | null {
  const maxStores = options.maxStores ?? 2;
  const storeVisitCost = options.storeVisitCost ?? 0;
  if (!Number.isInteger(maxStores) || maxStores < 1 || maxStores > 5) return null;
  if (!Number.isFinite(storeVisitCost) || storeVisitCost < 0) return null;

  const validItems = items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  const validOffers = offers.filter((offer) => Number.isFinite(offer.unitPrice) && offer.unitPrice >= 0);
  if (!validItems.length || !validOffers.length) return null;

  const ruleMap = new Map<string, FulfilmentRule>();
  for (const rule of rules) {
    if (!rule.isAvailable || rule.fulfilmentMode !== 'delivery') continue;
    if (!Number.isFinite(rule.deliveryFee) || rule.deliveryFee < 0) return null;
    if (!Number.isFinite(rule.minimumOrderValue ?? 0) || (rule.minimumOrderValue ?? 0) < 0) return null;
    if (!rule.currency || rule.currency.length !== 3) return null;
    const key = ruleKey(rule.retailerId, rule.branchId);
    if (ruleMap.has(key)) return null;
    ruleMap.set(key, rule);
  }

  const retailerIds = [...new Set(validOffers.map((offer) => offer.retailerId))].sort();
  let best: FulfilmentCandidate | null = null;

  function getRule(offer: SavingsOffer) {
    return ruleMap.get(ruleKey(offer.retailerId, offer.branchId)) ?? ruleMap.get(ruleKey(offer.retailerId, null));
  }

  function evaluate(selected: string[]) {
    const allocations: FulfilmentOptimization['allocations'] = [];
    for (const item of validItems) {
      const offer = validOffers
        .filter((candidate) => candidate.productId === item.productId && selected.includes(candidate.retailerId))
        .filter((candidate) => {
          const rule = getRule(candidate);
          return rule !== undefined && rule.currency === candidate.currency;
        })
        .sort((a, b) => a.unitPrice - b.unitPrice || a.retailerId.localeCompare(b.retailerId) || (a.branchId ?? '').localeCompare(b.branchId ?? '') || a.specialId.localeCompare(b.specialId))[0];
      if (!offer) return;
      allocations.push({ ...item, ...offer, lineTotal: round(item.quantity * offer.unitPrice) });
    }

    const fulfilmentMap = new Map<string, { retailerId: string; retailerName: string; branchId: string | null; subtotal: number; rule: FulfilmentRule }>();
    for (const item of allocations) {
      const rule = getRule(item);
      if (!rule) return;
      const key = ruleKey(item.retailerId, item.branchId);
      const existing = fulfilmentMap.get(key);
      if (existing) existing.subtotal = round(existing.subtotal + item.lineTotal);
      else fulfilmentMap.set(key, { retailerId: item.retailerId, retailerName: item.retailerName, branchId: item.branchId ?? null, subtotal: item.lineTotal, rule });
    }

    let fees = 0;
    for (const row of fulfilmentMap.values()) {
      const minimumOrder = row.rule.minimumOrderValue ?? 0;
      // A minimum order is a hard commercial constraint, not a synthetic surcharge.
      if (row.subtotal < minimumOrder) return;
      fees += row.rule.deliveryFee;
    }

    const productCost = round(allocations.reduce((sum, item) => sum + item.lineTotal, 0));
    const actualRetailers = [...new Set(allocations.map((item) => item.retailerId))].sort();
    const landedCost = round(productCost + fees + actualRetailers.length * storeVisitCost);
    const candidate: FulfilmentCandidate = { allocations, productCost, retailers: actualRetailers, landedCost, fees: round(fees), surcharges: 0 };
    if (!best || landedCost < best.landedCost || (landedCost === best.landedCost && (actualRetailers.length < best.retailers.length || (actualRetailers.length === best.retailers.length && actualRetailers.join(',') < best.retailers.join(','))))) best = candidate;
  }

  function combinations(start: number, chosen: string[]) {
    if (chosen.length) evaluate(chosen);
    if (chosen.length === maxStores) return;
    for (let index = start; index < retailerIds.length; index++) combinations(index + 1, [...chosen, retailerIds[index]]);
  }
  combinations(0, []);

  const winner = best;
  if (!winner) return null;

  const retailerSubtotals = [...new Map(winner.allocations.map((item) => [ruleKey(item.retailerId, item.branchId), item])).values()]
    .map((item) => {
      const subtotal = round(winner.allocations.filter((allocation) => ruleKey(allocation.retailerId, allocation.branchId) === ruleKey(item.retailerId, item.branchId)).reduce((sum, allocation) => sum + allocation.lineTotal, 0));
      const rule = getRule(item);
      const deliveryFee = rule?.deliveryFee ?? 0;
      const minimumOrder = rule?.minimumOrderValue ?? 0;
      return {
        retailerId: item.retailerId,
        retailerName: item.retailerName,
        subtotal,
        deliveryFee,
        storeVisitCost,
        minimumOrder,
        minimumOrderSurcharge: 0,
        landedSubtotal: round(subtotal + deliveryFee + storeVisitCost),
      };
    })
    .sort((a, b) => a.retailerName.localeCompare(b.retailerName) || a.retailerId.localeCompare(b.retailerId));

  return {
    totalProductCost: winner.productCost,
    deliveryFees: winner.fees,
    storeVisitCost: round(winner.retailers.length * storeVisitCost),
    minimumOrderSurcharges: winner.surcharges,
    totalLandedCost: winner.landedCost,
    retailerCount: winner.retailers.length,
    allocations: winner.allocations,
    retailerSubtotals,
  };
}
