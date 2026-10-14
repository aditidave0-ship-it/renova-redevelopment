import { logger } from "./logger";

export type EmailMessage = {
  idempotencyKey?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};
export type EmailAcceptance = {
  status: "ACCEPTED";
  provider: string;
  providerMessageId: string | null;
};
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailAcceptance>;
}

export type EmailBrand = { productName: string; appUrl: string; from: string };

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export function getEmailBrand(): EmailBrand {
  const productName =
    process.env.RENOVA_PRODUCT_NAME?.trim() || "Redevelopment Platform";
  const appUrl = (
    process.env.RENOVA_APP_URL?.trim() || "http://localhost:5173"
  ).replace(/\/$/, "");
  const configuredFrom = process.env.RENOVA_EMAIL_FROM?.trim();
  if (process.env.NODE_ENV === "production") {
    let valid = false;
    try {
      const url = new URL(appUrl);
      valid =
        Boolean(process.env.RENOVA_APP_URL) &&
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash;
    } catch {
      /* Invalid configuration is unavailable. */
    }
    if (!valid || !configuredFrom) {
      const error = new Error("Production email branding is not configured");
      Object.assign(error, { status: 503, code: "EMAIL_DELIVERY_UNAVAILABLE" });
      throw error;
    }
  }
  return {
    productName,
    appUrl,
    from: configuredFrom || `${productName} <onboarding@resend.dev>`,
  };
}

export function isEmailDeliveryConfigured(): boolean {
  return (
    process.env.RENOVA_EMAIL_PROVIDER?.trim().toLowerCase() === "resend" &&
    Boolean(process.env.RESEND_API_KEY)
  );
}

export function verificationEmail(
  brand: EmailBrand,
  otp: string,
): Omit<EmailMessage, "to"> {
  const name = escapeHtml(brand.productName);
  const safeOtp = escapeHtml(otp);
  return {
    subject: `Verify your ${brand.productName} email`,
    text: `Your verification code is ${otp}. It expires in 10 minutes. If you did not request this account, you can ignore this message.`,
    html: `<h1>Verify your email</h1><p>Finish creating your ${name} account with this one-time code:</p><p style="font-size:28px;font-weight:700;letter-spacing:0.22em">${safeOtp}</p><p>This code expires in 10 minutes and can be used once. If you did not request this account, you can ignore this message.</p>`,
  };
}

export function welcomeEmail(brand: EmailBrand): Omit<EmailMessage, "to"> {
  const name = escapeHtml(brand.productName);
  const signInUrl = `${brand.appUrl}/platform/live`;
  return {
    subject: `Welcome to ${brand.productName}`,
    text: `Your email is verified and your ${brand.productName} account is active. Sign in: ${signInUrl}`,
    html: `<h1>Welcome to ${name}</h1><p>Your email is verified and your account is active.</p><p><a href="${escapeHtml(signInUrl)}">Sign in to your workspace</a></p>`,
  };
}

export function enquiryAcknowledgementEmail(
  brand: EmailBrand,
  enquiry: { name: string; reference: string },
): Omit<EmailMessage, "to"> {
  const name = escapeHtml(enquiry.name);
  const reference = escapeHtml(enquiry.reference);
  const productName = escapeHtml(brand.productName);
  return {
    subject: `${brand.productName} enquiry ${enquiry.reference}`,
    text: `Hello ${enquiry.name}, we received your enquiry. Reference: ${enquiry.reference}. Our team will review the details and coordinate the next step.`,
    html: `<h1>Enquiry received</h1><p>Hello ${name},</p><p>${productName} received your enquiry and will review the details before coordinating the next step.</p><p><strong>Reference:</strong> ${reference}</p>`,
  };
}

export function adminEnquiryNotificationEmail(
  brand: EmailBrand,
  enquiry: {
    reference: string;
    organizationName: string;
    source: string;
  },
): Omit<EmailMessage, "to"> {
  const reference = escapeHtml(enquiry.reference);
  const organizationName = escapeHtml(enquiry.organizationName);
  const source = escapeHtml(enquiry.source);
  return {
    subject: `New enquiry ${enquiry.reference}`,
    text: `A new enquiry was saved. Reference: ${enquiry.reference}. Organization: ${enquiry.organizationName}. Source: ${enquiry.source}.`,
    html: `<h1>New enquiry</h1><p><strong>Reference:</strong> ${reference}</p><p><strong>Organization:</strong> ${organizationName}</p><p><strong>Source:</strong> ${source}</p><p>Open the protected Admin workspace to review the full submission.</p>`,
  };
}

export function passwordResetEmail(
  brand: EmailBrand,
  token: string,
): Omit<EmailMessage, "to"> {
  const name = escapeHtml(brand.productName);
  const link = `${brand.appUrl}/platform/live#reset=${encodeURIComponent(token)}`;
  return {
    subject: `Reset your ${brand.productName} password`,
    text: `Reset your password by opening this link within 1 hour: ${link}`,
    html: `<h1>Reset your password</h1><p>A password reset was requested for your ${name} account.</p><p><a href="${escapeHtml(link)}">Choose a new password</a></p><p>This link expires in 1 hour. If you did not request it, you can ignore this message.</p>`,
  };
}

class DisabledEmailProvider implements EmailProvider {
  async send(): Promise<EmailAcceptance> {
    const error = new Error("Transactional email delivery is not configured");
    Object.assign(error, { status: 503, code: "EMAIL_DELIVERY_UNAVAILABLE" });
    throw error;
  }
}

class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}
  async send(message: EmailMessage): Promise<EmailAcceptance> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        ...(message.idempotencyKey
          ? { "Idempotency-Key": message.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      logger.error(
        { statusCode: response.status },
        "Transactional email provider rejected a request",
      );
      const error = new Error("Transactional email could not be sent");
      Object.assign(error, { status: 503, code: "EMAIL_DELIVERY_FAILED" });
      throw error;
    }
    const payload = (await response.json().catch(() => null)) as {
      id?: unknown;
    } | null;
    return {
      status: "ACCEPTED",
      provider: "resend",
      providerMessageId: typeof payload?.id === "string" ? payload.id : null,
    };
  }
}

export function getEmailProvider(brand = getEmailBrand()): EmailProvider {
  const provider =
    process.env.RENOVA_EMAIL_PROVIDER?.trim().toLowerCase() || "disabled";
  const key = process.env.RESEND_API_KEY;
  if (provider === "resend" && key)
    return new ResendEmailProvider(key, brand.from);
  return new DisabledEmailProvider();
}

export async function sendVerificationEmail(
  to: string,
  otp: string,
): Promise<EmailAcceptance> {
  const brand = getEmailBrand();
  return getEmailProvider(brand).send({
    to,
    ...verificationEmail(brand, otp),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<EmailAcceptance> {
  const brand = getEmailBrand();
  return getEmailProvider(brand).send({
    to,
    ...passwordResetEmail(brand, token),
  });
}
