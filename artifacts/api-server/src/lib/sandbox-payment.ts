import { createHmac, timingSafeEqual } from "node:crypto";

export function sandboxPaymentConfig(env: NodeJS.ProcessEnv = process.env) {
  if (
    env.VERCEL_ENV === "production" ||
    env.RENOVA_PAYMENTS_MODE !== "sandbox" ||
    !/^rzp_test_[A-Za-z0-9]+$/.test(env.RAZORPAY_TEST_KEY_ID ?? "") ||
    !env.RAZORPAY_TEST_KEY_SECRET ||
    !env.RAZORPAY_TEST_WEBHOOK_SECRET
  )
    throw Object.assign(
      new Error(
        "Sandbox payments are not configured. Live payments are unavailable.",
      ),
      { status: 503 },
    );
  return {
    keyId: env.RAZORPAY_TEST_KEY_ID!,
    keySecret: env.RAZORPAY_TEST_KEY_SECRET!,
    webhookSecret: env.RAZORPAY_TEST_WEBHOOK_SECRET!,
  };
}
export function validWebhookSignature(
  raw: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function sandboxProviderRequest(
  path: string,
  body?: object,
): Promise<Record<string, unknown>> {
  const config = sandboxPaymentConfig();
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(8000),
    headers: {
      authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw Object.assign(
      new Error("Sandbox provider could not confirm this request"),
      { status: 503 },
    );
  const value = await response.json();
  if (!value || typeof value !== "object")
    throw Object.assign(new Error("Invalid sandbox provider response"), {
      status: 503,
    });
  return value as Record<string, unknown>;
}
