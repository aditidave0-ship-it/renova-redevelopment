/** Public-facing brand identity. Keep internal RENOVA identifiers for compatibility. */
export const BRAND_NAME = "NIRMAQ";

/** Intended origin only. Domain attachment, DNS and HTTPS are not verified. */
export const APP_ORIGIN = "https://nirmaq.in";

/**
 * Public contact email, display only. The mailbox and the nirmaq.in domain
 * attachment/DNS/HTTPS are not verified — showing this address does not prove
 * it can send or receive mail. It is not the email sender and not the
 * enquiry recipient (enquiries go to ENQUIRY_NOTIFICATION_EMAIL).
 */
export const CONTACT_EMAIL = "info@nirmaq.in";

// Preserve existing RENOVA_* environment-variable names and their compatibility
// until a separately approved email/domain migration updates runtime configuration.
