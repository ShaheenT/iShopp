export type SavingsItem = { productId: string; quantity: number };

export type SavingsOffer = {
  productId: string;
  retailerId: string;
  retailerName: string;
  branchId: string | null;
  branchName: string | null;
  specialId: string;
  unitPrice: number;
  currency: string;
};

export type SavingsAllocation = SavingsItem & SavingsOffer & { lineTotal: number };

export type SavingsOptimization = {
  totalProductCost: number;
  storeVisitCost: number;
  totalLandedCost: number;
  retailerCount: number;
  allocations: SavingsAllocation[];
  retailerSubtotals: Array<{
    retailerId: string;
    retailerName: string;
    subtotal: number;
    visitCost: number;
    landedSubtotal: number;
  }>;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

export function optimizeSavings(
  items: SavingsItem[],
  offers: SavingsOffer[],
  options: { maxStores?: number; storeVisitCost?: number } = {},
): SavingsOptimization | null {
  const maxStores = options.maxStores ?? 2;
  const storeVisitCost = options.storeVisitCost ?? 0;
  if (!Number.isInteger(maxStores) || maxStores < 1 || maxStores > 5) return null;
  if (!Number.isFinite(storeVisitCost) || storeVisitCost < 0) return null;

  const validItems = items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  const validOffers = offers.filter((offer) => Number.isFinite(offer.unitPrice) && offer.unitPrice >= 0);
  const retailerIds = [...new Set(validOffers.map((offer) => offer.retailerId))].sort();
  let best: { allocations: SavingsAllocation[]; productCost: number; retailerIds: string[]; landedCost: number } | null = null;

  function evaluate(selected: string[]) {
    const allocations: SavingsAllocation[] = [];
    for (const item of validItems) {
      const offer = validOffers
        .filter((candidate) => candidate.productId === item.productId && selected.includes(candidate.retailerId))
        .sort((a, b) => a.unitPrice - b.unitPrice || a.retailerId.localeCompare(b.retailerId) || a.specialId.localeCompare(b.specialId))[0];
      if (!offer) return;
      allocations.push({ ...item, ...offer, lineTotal: round(item.quantity * offer.unitPrice) });
    }
    const productCost = round(allocations.reduce((sum, item) => sum + item.lineTotal, 0));
    const actualRetailers = [...new Set(allocations.map((item) => item.retailerId))].sort();
    const landedCost = round(productCost + actualRetailers.length * storeVisitCost);
    const candidate = { allocations, productCost, retailerIds: actualRetailers, landedCost };
    if (!best || landedCost < best.landedCost || (landedCost === best.landedCost && (actualRetailers.length < best.retailerIds.length || (actualRetailers.length === best.retailerIds.length && actualRetailers.join(",") < best.retailerIds.join(","))))) best = candidate;
  }

  function combinations(start: number, chosen: string[]) {
    if (chosen.length) evaluate(chosen);
    if (chosen.length === maxStores) return;
    for (let index = start; index < retailerIds.length; index++) combinations(index + 1, [...chosen, retailerIds[index]]);
  }
  combinations(0, []);
  if (!best) return null;

  const subtotalMap = new Map<string, { retailerId: string; retailerName: string; subtotal: number }>();
  for (const item of best.allocations) {
    const existing = subtotalMap.get(item.retailerId);
    if (existing) existing.subtotal = round(existing.subtotal + item.lineTotal);
    else subtotalMap.set(item.retailerId, { retailerId: item.retailerId, retailerName: item.retailerName, subtotal: item.lineTotal });
  }
  const retailerSubtotals = [...subtotalMap.values()].sort((a, b) => a.retailerName.localeCompare(b.retailerName)).map((row) => ({ ...row, visitCost: storeVisitCost, landedSubtotal: round(row.subtotal + storeVisitCost) }));

  return {
    totalProductCost: best.productCost,
    storeVisitCost: round(best.retailerIds.length * storeVisitCost),
    totalLandedCost: best.landedCost,
    retailerCount: best.retailerIds.length,
    allocations: best.allocations,
    retailerSubtotals,
  };
}
