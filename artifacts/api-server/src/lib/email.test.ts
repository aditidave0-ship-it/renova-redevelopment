import assert from "node:assert/strict";
import test from "node:test";
import {
  adminEnquiryNotificationEmail,
  enquiryAcknowledgementEmail,
  passwordResetEmail,
  verificationEmail,
  welcomeEmail,
} from "./email";

const brand = {
  productName: "Example Platform",
  appUrl: "https://example.test",
  from: "Example <onboarding@resend.dev>",
};

test("verification template uses configurable neutral branding and a ten-minute OTP", () => {
  const message = verificationEmail(brand, "123456");
  assert.match(message.subject, /Example Platform/);
  assert.match(message.text, /123456/);
  assert.match(message.text, /10 minutes/);
  assert.doesNotMatch(message.text, /#verify=/);
  assert.doesNotMatch(message.text, /RENOVA/);
});

test("welcome template confirms activation without claiming provider delivery", () => {
  const message = welcomeEmail(brand);
  assert.match(message.subject, /Welcome to Example Platform/);
  assert.match(message.text, /account is active/);
  assert.match(message.text, /https:\/\/example\.test\/platform\/live/);
});

test("enquiry templates use the saved reference and neutral branding", () => {
  const acknowledgement = enquiryAcknowledgementEmail(brand, {
    name: "Society Contact",
    reference: "REQ-2026-ABC123",
  });
  const notification = adminEnquiryNotificationEmail(brand, {
    reference: "REQ-2026-ABC123",
    organizationName: "Example Society",
    source: "FEASIBILITY",
  });
  assert.match(acknowledgement.text, /REQ-2026-ABC123/);
  assert.match(acknowledgement.text, /received your enquiry/);
  assert.match(notification.text, /Example Society/);
  assert.match(notification.text, /FEASIBILITY/);
});

test("password reset template documents its one-hour expiry", () => {
  const message = passwordResetEmail(brand, "reset-token");
  assert.match(message.text, /#reset=reset-token/);
  assert.match(message.text, /1 hour/);
});
