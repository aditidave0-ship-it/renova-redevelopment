import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFulfillable,
  assertPrivacyStatusTransition,
} from "./privacy-policy";

test("the privacy request lifecycle allows the documented transitions", () => {
  assertPrivacyStatusTransition("SUBMITTED", "IN_REVIEW");
  assertPrivacyStatusTransition("IN_REVIEW", "MORE_INFORMATION_REQUIRED");
  assertPrivacyStatusTransition("MORE_INFORMATION_REQUIRED", "IN_REVIEW");
  assertPrivacyStatusTransition("IN_REVIEW", "FULFILLED");
  assertPrivacyStatusTransition("IN_REVIEW", "REJECTED");
  assertPrivacyStatusTransition("FULFILLED", "CLOSED");
  assertPrivacyStatusTransition("REJECTED", "CLOSED");
  assertPrivacyStatusTransition("SUBMITTED", "CLOSED");
});

test("the privacy request lifecycle rejects skips and dead ends", () => {
  for (const [from, to] of [
    ["IDENTITY_PENDING", "IN_REVIEW"],
    ["IDENTITY_PENDING", "SUBMITTED"],
    ["SUBMITTED", "FULFILLED"],
    ["FULFILLED", "IN_REVIEW"],
    ["CLOSED", "IN_REVIEW"],
    ["CLOSED", "SUBMITTED"],
  ] as const) {
    assert.throws(
      () => assertPrivacyStatusTransition(from, to),
      (error: { status?: number; message: string }) =>
        error.status === 409 &&
        error.message === `Cannot move a privacy request from ${from} to ${to}`,
    );
  }
});

test("an unverified request cannot be fulfilled", () => {
  assert.throws(
    () =>
      assertFulfillable({ status: "IDENTITY_PENDING", holdReason: null }),
    (error: { status?: number }) => error.status === 409,
  );
});

test("a request under a legal, financial or security hold cannot be fulfilled", () => {
  assert.throws(
    () =>
      assertFulfillable({
        status: "IN_REVIEW",
        holdReason: "Ongoing legal matter",
      }),
    (error: { status?: number; message: string }) =>
      error.status === 409 && /hold/.test(error.message),
  );
});

test("a verified request with no hold can be fulfilled", () => {
  assertFulfillable({ status: "IN_REVIEW", holdReason: null });
  assertFulfillable({ status: "SUBMITTED", holdReason: null });
});
