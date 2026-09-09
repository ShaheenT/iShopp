export type BasketItem = {
  productId: string;
  quantity: number;
};

export type BasketOffer = {
  productId: string;
  retailerId: string;
  retailerName: string;
  branchId: string | null;
  branchName: string | null;
  specialId: string;
  specialPrice: number;
  currency: string;
};

export type BasketAllocation = BasketItem & {
  retailerId: string;
  retailerName: string;
  branchId: string | null;
  branchName: string | null;
  specialId: string;
  unitPrice: number;
  lineTotal: number;
  currency: string;
};

export type RetailerSubtotal = {
  retailerId: string;
  retailerName: string;
  itemCount: number;
  subtotal: number;
  currency: string;
};

export type BasketStrategy = {
  strategy: "split_minimum" | "single_retailer" | "practical" | "unavailable";
  total: number | null;
  retailerCount: number;
  allocations: BasketAllocation[];
  retailerSubtotals: RetailerSubtotal[];
  unavailableProductIds: string[];
};

export type BasketIntelligence = {
  currency: string | null;
  itemCount: number;
  requestedQuantity: number;
  splitMinimum: BasketStrategy;
  singleRetailer: BasketStrategy;
  practical: BasketStrategy;
  savingsVsSingleRetailer: number | null;
  savingsVsSplitMinimum: number | null;
};

type Candidate = {
  allocations: BasketAllocation[];
  total: number;
  retailerIds: Set<string>;
};

function validOffers(offers: BasketOffer[]): BasketOffer[] {
  return offers.filter(
    (offer) =>
      Number.isFinite(offer.specialPrice) &&
      offer.specialPrice >= 0 &&
      typeof offer.retailerId === "string" &&
      typeof offer.productId === "string",
  );
}

function allocation(item: BasketItem, offer: BasketOffer): BasketAllocation {
  return {
    ...item,
    retailerId: offer.retailerId,
    retailerName: offer.retailerName,
    branchId: offer.branchId,
    branchName: offer.branchName,
    specialId: offer.specialId,
    unitPrice: offer.specialPrice,
    lineTotal: Number((offer.specialPrice * item.quantity).toFixed(2)),
    currency: offer.currency,
  };
}

function summarize(
  strategy: BasketStrategy["strategy"],
  allocations: BasketAllocation[],
  unavailableProductIds: string[],
): BasketStrategy {
  const retailerMap = new Map<string, RetailerSubtotal>();
  for (const item of allocations) {
    const current = retailerMap.get(item.retailerId);
    if (current) {
      current.itemCount += 1;
      current.subtotal = Number((current.subtotal + item.lineTotal).toFixed(2));
    } else {
      retailerMap.set(item.retailerId, {
        retailerId: item.retailerId,
        retailerName: item.retailerName,
        itemCount: 1,
        subtotal: item.lineTotal,
        currency: item.currency,
      });
    }
  }
  const retailerSubtotals = [...retailerMap.values()].sort((a, b) => a.retailerName.localeCompare(b.retailerName));
  const total = unavailableProductIds.length ? null : Number(allocations.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  return { strategy, total, retailerCount: retailerSubtotals.length, allocations, retailerSubtotals, unavailableProductIds };
}

function bestSingleRetailer(items: BasketItem[], offers: BasketOffer[]): BasketStrategy {
  const byRetailer = new Map<string, BasketOffer[]>();
  for (const offer of offers) byRetailer.set(offer.retailerId, [...(byRetailer.get(offer.retailerId) ?? []), offer]);

  const candidates: Candidate[] = [];
  for (const retailerOffers of byRetailer.values()) {
    const byProduct = new Map<string, BasketOffer>();
    for (const offer of retailerOffers) {
      const current = byProduct.get(offer.productId);
      if (!current || offer.specialPrice < current.specialPrice || (offer.specialPrice === current.specialPrice && offer.specialId < current.specialId)) byProduct.set(offer.productId, offer);
    }
    if (items.every((item) => byProduct.has(item.productId))) {
      const allocations = items.map((item) => allocation(item, byProduct.get(item.productId)!));
      candidates.push({ allocations, total: allocations.reduce((sum, item) => sum + item.lineTotal, 0), retailerIds: new Set([retailerOffers[0].retailerId]) });
    }
  }
  candidates.sort((a, b) => a.total - b.total || [...a.retailerIds][0].localeCompare([...b.retailerIds][0]));
  return candidates[0] ? summarize("single_retailer", candidates[0].allocations, []) : summarize("unavailable", [], items.map((item) => item.productId));
}

function bestSplit(items: BasketItem[], offers: BasketOffer[]): BasketStrategy {
  const allocations: BasketAllocation[] = [];
  const unavailable: string[] = [];
  for (const item of items) {
    const candidates = offers.filter((offer) => offer.productId === item.productId).sort((a, b) => a.specialPrice - b.specialPrice || a.retailerName.localeCompare(b.retailerName) || a.retailerId.localeCompare(b.retailerId));
    if (candidates[0]) allocations.push(allocation(item, candidates[0]));
    else unavailable.push(item.productId);
  }
  return summarize(unavailable.length ? "unavailable" : "split_minimum", allocations, unavailable);
}

function bestPractical(items: BasketItem[], offers: BasketOffer[], maxStores: number): BasketStrategy {
  if (maxStores < 1 || !Number.isInteger(maxStores)) return bestSplit(items, offers);
  const retailerIds = [...new Set(offers.map((offer) => offer.retailerId))].sort();
  const candidates: Candidate[] = [];

  function evaluate(selected: string[]) {
    const allocations: BasketAllocation[] = [];
    for (const item of items) {
      const choices = offers.filter((offer) => offer.productId === item.productId && selected.includes(offer.retailerId)).sort((a, b) => a.specialPrice - b.specialPrice || a.retailerId.localeCompare(b.retailerId));
      if (!choices[0]) return;
      allocations.push(allocation(item, choices[0]));
    }
    candidates.push({ allocations, total: allocations.reduce((sum, item) => sum + item.lineTotal, 0), retailerIds: new Set(allocations.map((item) => item.retailerId)) });
  }

  function combinations(start: number, chosen: string[]) {
    if (chosen.length > 0) evaluate(chosen);
    if (chosen.length === maxStores) return;
    for (let i = start; i < retailerIds.length; i++) combinations(i + 1, [...chosen, retailerIds[i]]);
  }
  combinations(0, []);

  candidates.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    const storeDiff = a.retailerIds.size - b.retailerIds.size;
    if (storeDiff !== 0) return storeDiff;
    return [...a.retailerIds].sort().join(",").localeCompare([...b.retailerIds].sort().join(","));
  });
  return candidates[0] ? summarize("practical", candidates[0].allocations, []) : summarize("unavailable", [], items.map((item) => item.productId));
}

export function calculateBasketIntelligence(items: BasketItem[], rawOffers: BasketOffer[], maxStores = 2): BasketIntelligence {
  const normalizedItems = items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  const offers = validOffers(rawOffers);
  const splitMinimum = bestSplit(normalizedItems, offers);
  const singleRetailer = bestSingleRetailer(normalizedItems, offers);
  const practical = bestPractical(normalizedItems, offers, maxStores);
  const currency = offers[0]?.currency ?? null;
  const requestedQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  return {
    currency,
    itemCount: normalizedItems.length,
    requestedQuantity,
    splitMinimum,
    singleRetailer,
    practical,
    savingsVsSingleRetailer: singleRetailer.total !== null && splitMinimum.total !== null ? Number((singleRetailer.total - splitMinimum.total).toFixed(2)) : null,
    savingsVsSplitMinimum: practical.total !== null && splitMinimum.total !== null ? Number((practical.total - splitMinimum.total).toFixed(2)) : null,
  };
}
