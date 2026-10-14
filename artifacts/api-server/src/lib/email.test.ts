import assert from "node:assert/strict";
import test from "node:test";
import { passwordResetEmail, verificationEmail } from "./email";

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
