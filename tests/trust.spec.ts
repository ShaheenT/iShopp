import { test, expect } from "@playwright/test";
import { calculateCommunityTrust } from "../lib/community/trust";

test.describe("community trust", () => {
  test("starts new", () => {
    expect(calculateCommunityTrust(0, 0)).toEqual({
      verifiedSubmissionCount: 0,
      rejectedSubmissionCount: 0,
      verificationAccuracy: 0,
      trustScore: 0,
      trustLevel: "new",
    });
  });

  test("rewards verified contribution history", () => {
    const result = calculateCommunityTrust(10, 0);
    expect(result?.trustScore).toBe(80);
    expect(result?.trustLevel).toBe("trusted");
  });

  test("penalizes inaccurate contribution history", () => {
    const result = calculateCommunityTrust(10, 10);
    expect(result?.verificationAccuracy).toBe(50);
    expect(result?.trustScore).toBe(50);
    expect(result?.trustLevel).toBe("contributor");
  });

  test("rejects invalid counters", () => {
    expect(calculateCommunityTrust(-1, 0)).toBeNull();
    expect(calculateCommunityTrust(1.5, 0)).toBeNull();
  });
});
