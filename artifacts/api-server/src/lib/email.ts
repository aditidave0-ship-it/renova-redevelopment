import { logger } from "./logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
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
    try { const url = new URL(appUrl); valid = Boolean(process.env.RENOVA_APP_URL) && url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash; } catch { /* Invalid configuration is unavailable. */ }
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

export function verificationEmail(
  brand: EmailBrand,
  token: string,
): Omit<EmailMessage, "to"> {
  const name = escapeHtml(brand.productName);
  const link = `${brand.appUrl}/platform/live#verify=${encodeURIComponent(token)}`;
  return {
    subject: `Verify your ${brand.productName} email`,
    text: `Verify your email by opening this link within 24 hours: ${link}`,
    html: `<h1>Verify your email</h1><p>Finish creating your ${name} account.</p><p><a href="${escapeHtml(link)}">Verify email</a></p><p>This link expires in 24 hours. If you did not request this account, you can ignore this message.</p>`,
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
  async send(): Promise<void> {
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
  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
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
  token: string,
): Promise<void> {
  const brand = getEmailBrand();
  await getEmailProvider(brand).send({
    to,
    ...verificationEmail(brand, token),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const brand = getEmailBrand();
  await getEmailProvider(brand).send({
    to,
    ...passwordResetEmail(brand, token),
  });
}
