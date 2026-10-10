import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOpportunityClosable,
  assertOpportunityEditable,
  assertOpportunityPublishable,
  interestStateForReview,
} from "./opportunity-policy";

test("only draft opportunities can be edited and published", () => {
  assert.doesNotThrow(() => assertOpportunityEditable("DRAFT"));
  assert.doesNotThrow(() => assertOpportunityPublishable("DRAFT"));
  assert.throws(() => assertOpportunityEditable("PUBLISHED"), /draft/);
  assert.throws(() => assertOpportunityPublishable("CLOSED"), /draft/);
});

test("an opportunity cannot be closed twice", () => {
  assert.doesNotThrow(() => assertOpportunityClosable("PUBLISHED"));
  assert.throws(() => assertOpportunityClosable("CLOSED"), /already closed/);
});

test("interest workflow keeps database and review states aligned", () => {
  assert.equal(interestStateForReview("RECEIVED"), "PENDING");
  assert.equal(interestStateForReview("REVIEWING"), "PENDING");
  assert.equal(interestStateForReview("SHORTLISTED"), "ACCEPTED");
  assert.equal(interestStateForReview("DECLINED"), "DECLINED");
});
