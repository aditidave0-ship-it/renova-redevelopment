import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./session";

test("password hashes are salted and verify only the original password", () => {
  const first = hashPassword("correct horse battery staple");
  const second = hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(verifyPassword("correct horse battery staple", first), true);
  assert.equal(verifyPassword("incorrect", first), false);
});
