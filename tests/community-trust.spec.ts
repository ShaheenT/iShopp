import { test, expect } from "@playwright/test";

import { calculateCommunityTrust } from "@/lib/community/trust";

test.describe("community trust", () => {
  test("starts new with no verified outcomes", () => {
    expect(calculateCommunityTrust(0, 0)).toEqual({
      verifiedSubmissionCount: 0,
      rejectedSubmissionCount: 0,
      verificationAccuracy: 0,
      trustScore: 0,
      trustLevel: "new",
    });
  });

  test("rewards accurate verified contribution history", () => {
    expect(calculateCommunityTrust(10, 0)).toEqual({
      verifiedSubmissionCount: 10,
      rejectedSubmissionCount: 0,
      verificationAccuracy: 100,
      trustScore: 80,
      trustLevel: "trusted",
    });
  });

  test("penalizes rejected contribution history", () => {
    const trust = calculateCommunityTrust(8, 2);
    expect(trust?.verificationAccuracy).toBe(80);
    expect(trust?.trustScore).toBe(64);
    expect(trust?.trustLevel).toBe("trusted");
  });

  test("rejects invalid counts", () => {
    expect(calculateCommunityTrust(-1, 0)).toBeNull();
    expect(calculateCommunityTrust(1.5, 0)).toBeNull();
  });
});
