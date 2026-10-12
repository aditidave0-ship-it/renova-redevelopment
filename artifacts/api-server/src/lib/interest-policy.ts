export const INTEREST_REVIEW_STATUSES = ["RECEIVED", "REVIEWING", "SHORTLISTED", "DECLINED"] as const;
export type InterestReviewStatus = typeof INTEREST_REVIEW_STATUSES[number];

export function isDuplicateInterestError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505" || (error instanceof Error && /duplicate key|unique constraint/i.test(error.message));
}

export function assertInterestReviewOwnership(societyOrganizationId: string | null, owningSocietyOrganizationId: string): void {
  if (!societyOrganizationId || societyOrganizationId !== owningSocietyOrganizationId) {
    const error = new Error("Interest not found");
    Object.assign(error, { status: 404 });
    throw error;
  }
}
