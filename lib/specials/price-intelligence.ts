export type PriceSignal =
  | "exceptional"
  | "good"
  | "typical"
  | "high"
  | "insufficient_data";

export interface PriceObservation {
  specialPrice: number;
}

export interface PriceIntelligence {
  sampleSize: number;
  lowestPrice: number | null;
  highestPrice: number | null;
  medianPrice: number | null;
  currentPrice: number | null;
  currentRegularPrice: number | null;
  savingsPercent: number | null;
  priceVsMedianPercent: number | null;
  priceSignal: PriceSignal;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function calculatePriceIntelligence(
  observations: PriceObservation[],
  currentPrice: number | null,
  currentRegularPrice: number | null = null,
): PriceIntelligence {
  const validPrices = observations
    .map((observation) => observation.specialPrice)
    .filter((price) => Number.isFinite(price) && price >= 0);

  const medianPrice = median(validPrices);
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;

  const savingsPercent =
    currentPrice !== null &&
    currentRegularPrice !== null &&
    currentRegularPrice > 0
      ? round(((currentRegularPrice - currentPrice) / currentRegularPrice) * 100)
      : null;

  const priceVsMedianPercent =
    currentPrice !== null && medianPrice !== null && medianPrice > 0
      ? round(((currentPrice - medianPrice) / medianPrice) * 100)
      : null;

  let priceSignal: PriceSignal = "insufficient_data";
  if (currentPrice !== null && medianPrice !== null) {
    if (currentPrice < medianPrice * 0.9) priceSignal = "exceptional";
    else if (currentPrice < medianPrice * 0.97) priceSignal = "good";
    else if (currentPrice <= medianPrice * 1.03) priceSignal = "typical";
    else priceSignal = "high";
  }

  return {
    sampleSize: validPrices.length,
    lowestPrice,
    highestPrice,
    medianPrice: medianPrice === null ? null : round(medianPrice),
    currentPrice,
    currentRegularPrice,
    savingsPercent,
    priceVsMedianPercent,
    priceSignal,
  };
}
