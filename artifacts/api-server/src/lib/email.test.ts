import assert from "node:assert/strict";
import test from "node:test";
import { getEmailBrand, passwordResetEmail, verificationEmail } from "./email";

const brand = {
  productName: "Example Platform",
  appUrl: "https://example.test",
  from: "Example <onboarding@resend.dev>",
};

test("verification template uses configurable neutral branding and a URL fragment", () => {
  const message = verificationEmail(brand, "secret-token");
  assert.match(message.subject, /Example Platform/);
  assert.match(message.text, /#verify=secret-token/);
  assert.doesNotMatch(message.text, /RENOVA/);
});

test("password reset template documents its one-hour expiry", () => {
  const message = passwordResetEmail(brand, "reset-token");
  assert.match(message.text, /#reset=reset-token/);
  assert.match(message.text, /1 hour/);
});

test("production email configuration requires an explicit HTTPS origin and sender without fixing a brand domain", () => {
  const previous = { node: process.env.NODE_ENV, url: process.env.RENOVA_APP_URL, sender: process.env.RENOVA_EMAIL_FROM };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.RENOVA_APP_URL; delete process.env.RENOVA_EMAIL_FROM;
    assert.throws(() => getEmailBrand(), /not configured/);
    process.env.RENOVA_EMAIL_FROM = "Example <email@example.test>";
    process.env.RENOVA_APP_URL = "http://example.test";
    assert.throws(() => getEmailBrand(), /not configured/);
    process.env.RENOVA_APP_URL = "https://example.test";
    assert.equal(getEmailBrand().appUrl, "https://example.test");
    process.env.RENOVA_APP_URL = "https://user:password@example.test";
    assert.throws(() => getEmailBrand(), /not configured/);
  } finally {
    for (const [key, value] of [["NODE_ENV",previous.node],["RENOVA_APP_URL",previous.url],["RENOVA_EMAIL_FROM",previous.sender]] as const) {
      if(value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
