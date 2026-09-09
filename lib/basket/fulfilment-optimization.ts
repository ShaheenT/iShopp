import type { SavingsItem, SavingsOffer } from './savings-optimization';

export type FulfilmentRule = {
  retailerId: string;
  deliveryFee?: number;
  minimumOrder?: number;
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

const round = (value: number) => Number(value.toFixed(2));

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
  const ruleMap = new Map(rules.map((rule) => [rule.retailerId, rule]));
  for (const rule of rules) {
    if (!Number.isFinite(rule.deliveryFee ?? 0) || (rule.deliveryFee ?? 0) < 0) return null;
    if (!Number.isFinite(rule.minimumOrder ?? 0) || (rule.minimumOrder ?? 0) < 0) return null;
  }

  const retailerIds = [...new Set(validOffers.map((offer) => offer.retailerId))].sort();
  let best: { allocations: FulfilmentOptimization['allocations']; productCost: number; retailers: string[]; landedCost: number; fees: number; surcharges: number } | null = null;

  function evaluate(selected: string[]) {
    const allocations: FulfilmentOptimization['allocations'] = [];
    for (const item of validItems) {
      const offer = validOffers
        .filter((candidate) => candidate.productId === item.productId && selected.includes(candidate.retailerId))
        .sort((a, b) => a.unitPrice - b.unitPrice || a.retailerId.localeCompare(b.retailerId) || a.specialId.localeCompare(b.specialId))[0];
      if (!offer) return;
      allocations.push({ ...item, ...offer, lineTotal: round(item.quantity * offer.unitPrice) });
    }

    const subtotalMap = new Map<string, { retailerId: string; retailerName: string; subtotal: number }>();
    for (const item of allocations) {
      const existing = subtotalMap.get(item.retailerId);
      if (existing) existing.subtotal = round(existing.subtotal + item.lineTotal);
      else subtotalMap.set(item.retailerId, { retailerId: item.retailerId, retailerName: item.retailerName, subtotal: item.lineTotal });
    }

    let fees = 0;
    let surcharges = 0;
    for (const row of subtotalMap.values()) {
      const rule = ruleMap.get(row.retailerId);
      const deliveryFee = rule?.deliveryFee ?? 0;
      const minimumOrder = rule?.minimumOrder ?? 0;
      fees += deliveryFee;
      surcharges += Math.max(0, minimumOrder - row.subtotal);
    }
    const productCost = round(allocations.reduce((sum, item) => sum + item.lineTotal, 0));
    const actualRetailers = [...subtotalMap.keys()].sort();
    const landedCost = round(productCost + fees + surcharges + actualRetailers.length * storeVisitCost);
    const candidate = { allocations, productCost, retailers: actualRetailers, landedCost, fees: round(fees), surcharges: round(surcharges) };
    if (!best || landedCost < best.landedCost || (landedCost === best.landedCost && (actualRetailers.length < best.retailers.length || (actualRetailers.length === best.retailers.length && actualRetailers.join(',') < best.retailers.join(','))))) best = candidate;
  }

  function combinations(start: number, chosen: string[]) {
    if (chosen.length) evaluate(chosen);
    if (chosen.length === maxStores) return;
    for (let index = start; index < retailerIds.length; index++) combinations(index + 1, [...chosen, retailerIds[index]]);
  }
  combinations(0, []);
  if (!best) return null;

  const retailerSubtotals = [...new Map(best.allocations.map((item) => [item.retailerId, item])).values()]
    .map((item) => {
      const subtotal = round(best!.allocations.filter((allocation) => allocation.retailerId === item.retailerId).reduce((sum, allocation) => sum + allocation.lineTotal, 0));
      const rule = ruleMap.get(item.retailerId);
      const deliveryFee = rule?.deliveryFee ?? 0;
      const minimumOrder = rule?.minimumOrder ?? 0;
      const minimumOrderSurcharge = round(Math.max(0, minimumOrder - subtotal));
      return {
        retailerId: item.retailerId,
        retailerName: item.retailerName,
        subtotal,
        deliveryFee,
        storeVisitCost,
        minimumOrder,
        minimumOrderSurcharge,
        landedSubtotal: round(subtotal + deliveryFee + storeVisitCost + minimumOrderSurcharge),
      };
    })
    .sort((a, b) => a.retailerName.localeCompare(b.retailerName));

  return {
    totalProductCost: best.productCost,
    deliveryFees: best.fees,
    storeVisitCost: round(best.retailers.length * storeVisitCost),
    minimumOrderSurcharges: best.surcharges,
    totalLandedCost: best.landedCost,
    retailerCount: best.retailers.length,
    allocations: best.allocations,
    retailerSubtotals,
  };
}
