export const OPPORTUNITY_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "UNDER_REVIEW",
  "CLOSED",
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

function conflict(message: string): never {
  const error = new Error(message);
  Object.assign(error, { status: 409 });
  throw error;
}

export function assertOpportunityEditable(status: OpportunityStatus): void {
  if (status !== "DRAFT") conflict("Only draft opportunities can be edited");
}

export function assertOpportunityPublishable(status: OpportunityStatus): void {
  if (status !== "DRAFT") conflict("Only draft opportunities can be published");
}

export function assertOpportunityClosable(status: OpportunityStatus): void {
  if (status === "CLOSED") conflict("This opportunity is already closed");
}

export function interestStateForReview(
  reviewStatus: "RECEIVED" | "REVIEWING" | "SHORTLISTED" | "DECLINED",
): "PENDING" | "ACCEPTED" | "DECLINED" {
  if (reviewStatus === "SHORTLISTED") return "ACCEPTED";
  if (reviewStatus === "DECLINED") return "DECLINED";
  return "PENDING";
}
