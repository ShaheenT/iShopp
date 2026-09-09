import { test, expect } from "@playwright/test";
import { communityPriceSubmissionSchema } from "@/lib/community/price-submission";

test.describe("community price submissions", () => {
  const base = {
    productId: "00000000-0000-0000-0000-000000000001",
    retailerId: "00000000-0000-0000-0000-000000000002",
    observedPrice: 79.99,
    regularPrice: 99.99,
    currency: "ZAR",
    sourceUrl: "https://example.com/product",
    evidence: { sourceUrl: "https://example.com/product" },
  };

  test("accepts an evidence-backed observation", () => {
    expect(communityPriceSubmissionSchema.safeParse(base).success).toBe(true);
  });

  test("requires usable evidence", () => {
    expect(communityPriceSubmissionSchema.safeParse({ ...base, evidence: {} }).success).toBe(false);
  });

  test("rejects a regular price below the observed price", () => {
    expect(communityPriceSubmissionSchema.safeParse({ ...base, regularPrice: 50 }).success).toBe(false);
  });

  test("rejects malformed currency and negative prices", () => {
    expect(communityPriceSubmissionSchema.safeParse({ ...base, currency: "zar", observedPrice: -1 }).success).toBe(false);
  });
});
