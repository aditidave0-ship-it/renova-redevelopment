import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, requireRole, verifyPassword } from "./session";

test("password hashes are salted and verify only the original password", () => {
  const first = hashPassword("correct horse battery staple");
  const second = hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(verifyPassword("correct horse battery staple", first), true);
  assert.equal(verifyPassword("incorrect", first), false);
});

test("server role guards reject cross-role API access", () => {
  let statusCode = 0;
  let payload: unknown;
  let nextCalled = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };
  const guard = requireRole("SOCIETY");
  guard(
    { auth: { role: "DEVELOPER" } } as never,
    response as never,
    (() => {
      nextCalled = true;
    }) as never,
  );
  assert.equal(statusCode, 403);
  assert.deepEqual(payload, {
    error: "You do not have permission for this action",
  });
  assert.equal(nextCalled, false);
});
