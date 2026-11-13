// NIRMAQ Phase B — consent ledger policy.
//
// The consent ledger is append-only: consent is recorded as an event, and a
// withdrawal is a new event. Nothing here updates or deletes an event, and
// no code path may treat a checkbox as a record — the event row is the
// record. Consent is versioned: CONSENT_VERSION identifies the wording the
// subject agreed to, so a wording change is a new version, not a silent
// reinterpretation of old consent.
export const CONSENT_VERSION = "v1";

export const CONSENT_PURPOSES = ["ENQUIRY_RESPONSE"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export type ConsentAction = "GIVEN" | "WITHDRAWN";
export type ConsentSubjectType = "ENQUIRY" | "ACCOUNT";

function badRequest(message: string): never {
  const error = new Error(message);
  Object.assign(error, { status: 400 });
  throw error;
}

export function assertConsentPurpose(
  purpose: string,
): asserts purpose is ConsentPurpose {
  if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose))
    badRequest(`Unknown consent purpose: ${purpose}`);
}

// The consent event recorded when an enquiry is accepted. Written in the
// same database transaction as the enquiry itself: either both persist or
// neither does.
export function consentEventForEnquiry(enquiry: {
  id: string;
  email: string;
  source: string;
  reference: string;
}) {
  return {
    subjectType: "ENQUIRY" as const,
    subjectId: enquiry.id,
    email: enquiry.email,
    purpose: "ENQUIRY_RESPONSE" as const,
    consentVersion: CONSENT_VERSION,
    action: "GIVEN" as const,
    actor: "SUBJECT",
    metadata: { source: enquiry.source, reference: enquiry.reference },
  };
}
