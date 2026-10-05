import assert from "node:assert/strict";
import test from "node:test";
import { assertInterestReviewOwnership, INTEREST_REVIEW_STATUSES, isDuplicateInterestError } from "./interest-policy";

test("interest review exposes only the approved factual workflow states", () => {
  assert.deepEqual(INTEREST_REVIEW_STATUSES, ["RECEIVED", "REVIEWING", "SHORTLISTED", "DECLINED"]);
  assert.equal(INTEREST_REVIEW_STATUSES.includes("SHORTLISTED"), true);
});

test("database uniqueness violations are recognized as duplicate interests", () => {
  assert.equal(isDuplicateInterestError({ code: "23505" }), true);
  assert.equal(isDuplicateInterestError(new Error("duplicate key violates unique constraint")), true);
  assert.equal(isDuplicateInterestError(new Error("connection unavailable")), false);
});

test("a society cannot review another society's interest", () => {
  assert.doesNotThrow(() => assertInterestReviewOwnership("society-a", "society-a"));
  assert.throws(() => assertInterestReviewOwnership("society-a", "society-b"), /not found/);
});
