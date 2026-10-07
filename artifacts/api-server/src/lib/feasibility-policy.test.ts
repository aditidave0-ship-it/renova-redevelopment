import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFeasibilityOwnership,
  assertFeasibilityTransition,
  canSocietyEditFeasibility,
  documentContentMatchesType,
  FEASIBILITY_STATUSES,
  requiresMissingInformation,
} from "./feasibility-policy";

test("feasibility uses only the approved workflow statuses", () => {
  assert.deepEqual(FEASIBILITY_STATUSES, [
    "DRAFT",
    "SUBMITTED",
    "IN_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "ASSESSMENT_READY",
    "CLOSED",
  ]);
});

test("societies may edit drafts and requests returned for information", () => {
  assert.equal(canSocietyEditFeasibility("DRAFT"), true);
  assert.equal(canSocietyEditFeasibility("MORE_INFORMATION_REQUIRED"), true);
  assert.equal(canSocietyEditFeasibility("IN_REVIEW"), false);
  assert.equal(canSocietyEditFeasibility("ASSESSMENT_READY"), false);
});

test("invalid status jumps are rejected", () => {
  assert.doesNotThrow(() => assertFeasibilityTransition("DRAFT", "SUBMITTED"));
  assert.doesNotThrow(() =>
    assertFeasibilityTransition("IN_REVIEW", "ASSESSMENT_READY"),
  );
  assert.throws(
    () => assertFeasibilityTransition("DRAFT", "ASSESSMENT_READY"),
    /Status cannot move/,
  );
});

test("ownership failures are indistinguishable from a missing request", () => {
  assert.doesNotThrow(() =>
    assertFeasibilityOwnership("society-a", "society-a"),
  );
  assert.throws(
    () => assertFeasibilityOwnership("society-b", "society-a"),
    /not found/,
  );
  assert.equal(requiresMissingInformation("MORE_INFORMATION_REQUIRED"), true);
});

test("document type validation checks file signatures rather than trusting headers", () => {
  assert.equal(documentContentMatchesType(Buffer.from("%PDF-1.7"), "application/pdf"), true);
  assert.equal(documentContentMatchesType(Buffer.from("not a pdf"), "application/pdf"), false);
  assert.equal(documentContentMatchesType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"), true);
  assert.equal(documentContentMatchesType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
});
