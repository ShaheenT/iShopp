export type SavingsOffer = {
  productId: string;
  retailerId: string;
  retailerName: string;
  price: number;
  currency: string;
  quantity: number;
};

export type BasketSavingsSummary = {
  currentCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercent: number;
  currency: string;
};

export function calculateBasketSavings(
  offers: SavingsOffer[],
  currency: string,
): BasketSavingsSummary {
  const currentCost = roundMoney(
    offers.reduce((total, offer) => total + offer.price * offer.quantity, 0),
  );
  const byProduct = new Map<string, SavingsOffer>();

  for (const offer of offers) {
    const existing = byProduct.get(offer.productId);
    if (!existing || offer.price < existing.price) {
      byProduct.set(offer.productId, offer);
    }
  }

  const optimizedCost = roundMoney(
    Array.from(byProduct.values()).reduce(
      (total, offer) => total + offer.price * offer.quantity,
      0,
    ),
  );
  const savings = roundMoney(Math.max(0, currentCost - optimizedCost));
  const savingsPercent = currentCost === 0 ? 0 : roundPercent((savings / currentCost) * 100);

  return { currentCost, optimizedCost, savings, savingsPercent, currency };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
