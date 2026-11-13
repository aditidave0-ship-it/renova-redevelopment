// NIRMAQ Phase B — privacy request lifecycle policy.
//
// A request moves: IDENTITY_PENDING → SUBMITTED → IN_REVIEW ⇄
// MORE_INFORMATION_REQUIRED → FULFILLED | REJECTED → CLOSED. Only the
// transitions in LEGAL_TRANSITIONS are allowed, and only an Admin may move a
// request (except verification, which is the requester's own token).
//
// Fulfilment is a recorded Admin decision, not an automated action: no
// automated deletion or erasure runs from this module until the owner +
// legal approve retention periods. A request under a legal, financial or
// security hold can never be fulfilled while the hold is active.
export const PRIVACY_REQUEST_TYPES = [
  "ACCESS",
  "CORRECTION",
  "DELETION",
] as const;
export type PrivacyRequestType =
  (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_STATUSES = [
  "IDENTITY_PENDING",
  "SUBMITTED",
  "IN_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "FULFILLED",
  "REJECTED",
  "CLOSED",
] as const;
export type PrivacyRequestStatus =
  (typeof PRIVACY_REQUEST_STATUSES)[number];

// Statuses an Admin may set directly. IDENTITY_PENDING and SUBMITTED are
// system states reached only by submission and verification.
export const ADMIN_SETTABLE_STATUSES = [
  "IN_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "FULFILLED",
  "REJECTED",
  "CLOSED",
] as const;

export const PRIVACY_TERMINAL_STATUSES = [
  "FULFILLED",
  "REJECTED",
  "CLOSED",
] as const;

const LEGAL_TRANSITIONS: Record<
  PrivacyRequestStatus,
  PrivacyRequestStatus[]
> = {
  IDENTITY_PENDING: [],
  SUBMITTED: ["IN_REVIEW", "REJECTED", "CLOSED"],
  IN_REVIEW: ["MORE_INFORMATION_REQUIRED", "FULFILLED", "REJECTED", "CLOSED"],
  MORE_INFORMATION_REQUIRED: ["IN_REVIEW", "REJECTED", "CLOSED"],
  FULFILLED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

function conflict(message: string): never {
  const error = new Error(message);
  Object.assign(error, { status: 409 });
  throw error;
}

export function assertPrivacyStatusTransition(
  from: PrivacyRequestStatus,
  to: PrivacyRequestStatus,
): void {
  if (!LEGAL_TRANSITIONS[from]?.includes(to))
    conflict(
      `Cannot move a privacy request from ${from} to ${to}`,
    );
}

export function assertFulfillable(request: {
  status: PrivacyRequestStatus;
  holdReason: string | null;
}): void {
  if (request.status === "IDENTITY_PENDING")
    conflict(
      "Verify the requester's identity before fulfilling this request",
    );
  if (request.holdReason)
    conflict(
      "This request is under a legal, financial or security hold and cannot be fulfilled",
    );
}

// A missing privacy table (the provisional Phase B migration not yet
// applied) must read as a temporary 503, never as a 500 with SQL detail.
// Mirrors the safe-503 pattern used for OTP verification database failures.
export function isPrivacySchemaUnavailable(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } })
    ?.code;
  const causeCode = (error as { cause?: { code?: unknown } })?.cause?.code;
  const value = typeof code === "string" ? code : causeCode;
  return (
    typeof value === "string" &&
    ["42P01", "42703", "3D000", "57P01", "57P02", "57P03"].includes(value)
  );
}

// Retention categories for privacy_retention_policies and the dry-run
// report. A category with no active policy reports "no policy configured"
// and nothing is treated as eligible.
export const RETENTION_CATEGORIES = [
  "ENQUIRY",
  "AUTH_TOKEN",
  "AUTH_SESSION",
  "AUDIT_LOG",
  "FEASIBILITY_DOCUMENT",
  "PRIVACY_REQUEST",
] as const;
export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];
