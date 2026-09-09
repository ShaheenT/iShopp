export type CommunityTrust = {
  verifiedSubmissionCount: number;
  rejectedSubmissionCount: number;
  verificationAccuracy: number;
  trustScore: number;
  trustLevel: "new" | "contributor" | "trusted" | "expert";
};

export function calculateCommunityTrust(
  verifiedSubmissionCount: number,
  rejectedSubmissionCount: number,
): CommunityTrust | null {
  if (!Number.isInteger(verifiedSubmissionCount) || verifiedSubmissionCount < 0) return null;
  if (!Number.isInteger(rejectedSubmissionCount) || rejectedSubmissionCount < 0) return null;

  const total = verifiedSubmissionCount + rejectedSubmissionCount;
  const verificationAccuracy = total === 0 ? 0 : Number(((verifiedSubmissionCount / total) * 100).toFixed(2));
  const contributionComponent = Math.min(verifiedSubmissionCount, 20) * 2;
  const trustScore = Math.min(100, Number((contributionComponent + verificationAccuracy * 0.6).toFixed(2)));
  const trustLevel = trustScore >= 85 ? "expert" : trustScore >= 60 ? "trusted" : trustScore >= 20 ? "contributor" : "new";

  return {
    verifiedSubmissionCount,
    rejectedSubmissionCount,
    verificationAccuracy,
    trustScore,
    trustLevel,
  };
}
