import { test, expect } from "@playwright/test";

import { calculatePriceIntelligence } from "@/lib/specials/price-intelligence";

test.describe("calculatePriceIntelligence", () => {
  test("calculates median, savings and an exceptional signal", () => {
    const result = calculatePriceIntelligence(
      [{ specialPrice: 100 }, { specialPrice: 110 }, { specialPrice: 120 }],
      90,
      120,
    );

    expect(result.sampleSize).toBe(3);
    expect(result.lowestPrice).toBe(100);
    expect(result.highestPrice).toBe(120);
    expect(result.medianPrice).toBe(110);
    expect(result.savingsPercent).toBe(25);
    expect(result.priceVsMedianPercent).toBe(-18.18);
    expect(result.priceSignal).toBe("exceptional");
  });

  test("handles an even number of observations", () => {
    const result = calculatePriceIntelligence(
      [{ specialPrice: 80 }, { specialPrice: 100 }, { specialPrice: 120 }, { specialPrice: 140 }],
      110,
    );

    expect(result.medianPrice).toBe(110);
    expect(result.priceVsMedianPercent).toBe(0);
    expect(result.priceSignal).toBe("typical");
  });

  test("filters invalid observations and reports insufficient data", () => {
    const result = calculatePriceIntelligence(
      [{ specialPrice: Number.NaN }, { specialPrice: -5 }],
      null,
    );

    expect(result.sampleSize).toBe(0);
    expect(result.medianPrice).toBeNull();
    expect(result.lowestPrice).toBeNull();
    expect(result.highestPrice).toBeNull();
    expect(result.priceSignal).toBe("insufficient_data");
  });

  test("does not calculate savings when regular price is zero", () => {
    const result = calculatePriceIntelligence([{ specialPrice: 20 }], 20, 0);

    expect(result.savingsPercent).toBeNull();
  });
});
