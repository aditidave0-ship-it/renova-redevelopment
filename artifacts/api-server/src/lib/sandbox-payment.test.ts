import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sandboxPaymentConfig, validWebhookSignature } from "./sandbox-payment";
test("sandbox payment configuration rejects live keys, production and absent configuration", () => {
  const env = {
    RENOVA_PAYMENTS_MODE: "sandbox",
    RAZORPAY_TEST_KEY_ID: "rzp_test_TESTONLY",
    RAZORPAY_TEST_KEY_SECRET: "TEST-ONLY",
    RAZORPAY_TEST_WEBHOOK_SECRET: "TEST-ONLY",
  };
  assert.equal(sandboxPaymentConfig(env).keyId, "rzp_test_TESTONLY");
  for (const value of [
    {},
    { ...env, VERCEL_ENV: "production" },
    { ...env, RENOVA_PAYMENTS_MODE: "live" },
    { ...env, RAZORPAY_TEST_KEY_ID: "rzp_live_TESTONLY" },
  ])
    assert.throws(() => sandboxPaymentConfig(value));
});
test("webhook verification requires an exact signature of the original bytes", () => {
  const body = Buffer.from('{"event":"payment.captured"}'),
    secret = "TEST-ONLY";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(validWebhookSignature(body, signature, secret), true);
  assert.equal(
    validWebhookSignature(
      Buffer.from('{ "event": "payment.captured" }'),
      signature,
      secret,
    ),
    false,
  );
  assert.equal(validWebhookSignature(body, "short", secret), false);
  assert.equal(validWebhookSignature(body, undefined, secret), false);
});
