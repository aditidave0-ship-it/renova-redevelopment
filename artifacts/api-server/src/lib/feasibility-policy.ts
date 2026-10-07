export const FEASIBILITY_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "ASSESSMENT_READY",
  "CLOSED",
] as const;

export type FeasibilityStatus = (typeof FEASIBILITY_STATUSES)[number];

const transitions: Record<FeasibilityStatus, readonly FeasibilityStatus[]> = {
  DRAFT: ["SUBMITTED", "CLOSED"],
  SUBMITTED: ["IN_REVIEW", "MORE_INFORMATION_REQUIRED", "CLOSED"],
  IN_REVIEW: ["MORE_INFORMATION_REQUIRED", "ASSESSMENT_READY", "CLOSED"],
  MORE_INFORMATION_REQUIRED: ["SUBMITTED", "IN_REVIEW", "CLOSED"],
  ASSESSMENT_READY: ["CLOSED"],
  CLOSED: [],
};

export function assertFeasibilityOwnership(
  requestSocietyId: string,
  accountSocietyId: string | null,
): void {
  if (!accountSocietyId || requestSocietyId !== accountSocietyId) {
    const error = new Error("Feasibility request not found");
    Object.assign(error, { status: 404 });
    throw error;
  }
}

export function assertFeasibilityTransition(
  from: FeasibilityStatus,
  to: FeasibilityStatus,
): void {
  if (!transitions[from].includes(to)) {
    const error = new Error(`Status cannot move from ${from} to ${to}`);
    Object.assign(error, { status: 409 });
    throw error;
  }
}

export function canSocietyEditFeasibility(status: FeasibilityStatus): boolean {
  return status === "DRAFT" || status === "MORE_INFORMATION_REQUIRED";
}

export function requiresMissingInformation(status: FeasibilityStatus): boolean {
  return status === "MORE_INFORMATION_REQUIRED";
}

export function documentContentMatchesType(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  if (contentType === "application/pdf")
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (contentType === "image/jpeg")
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png")
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return false;
}
