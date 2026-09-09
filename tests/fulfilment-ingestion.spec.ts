import { test, expect } from "@playwright/test";
import { fulfilmentIngestionSchema } from "@/lib/fulfilment/ingestion";


test.describe("fulfilment ingestion", () => {
  test("accepts evidence-backed pending rule input", () => {
    const result = fulfilmentIngestionSchema.safeParse({
      retailerId: "00000000-0000-0000-0000-000000000001",
      fulfilmentMode: "delivery",
      deliveryFee: 49,
      minimumOrderValue: 500,
      currency: "ZAR",
      startsAt: "2026-09-01T00:00:00+02:00",
      sourceUrl: "https://retailer.example/terms",
      sourceType: "retailer_terms",
      evidence: {
        sourceUrl: "https://retailer.example/terms",
        extractedData: { minimumOrderValue: 500, deliveryFee: 49 },
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects ingestion without rule source or usable evidence", () => {
    const result = fulfilmentIngestionSchema.safeParse({
      retailerId: "00000000-0000-0000-0000-000000000001",
      fulfilmentMode: "delivery",
      deliveryFee: 49,
      currency: "ZAR",
      startsAt: "2026-09-01T00:00:00+02:00",
      sourceType: "retailer_terms",
      evidence: {},
    });

    expect(result.success).toBe(false);
  });

  test("rejects invalid effective periods and commercial values", () => {
    const result = fulfilmentIngestionSchema.safeParse({
      retailerId: "00000000-0000-0000-0000-000000000001",
      fulfilmentMode: "delivery",
      deliveryFee: -1,
      minimumOrderValue: 100,
      currency: "zar",
      startsAt: "2026-09-02T00:00:00+02:00",
      endsAt: "2026-09-01T00:00:00+02:00",
      sourceUrl: "https://retailer.example/terms",
      sourceType: "retailer_terms",
      evidence: { sourceUrl: "https://retailer.example/terms" },
    });

    expect(result.success).toBe(false);
  });
});
