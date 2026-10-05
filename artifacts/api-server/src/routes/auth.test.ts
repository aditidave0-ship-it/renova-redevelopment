import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import authRouter from "./auth";
import app from "../renova-app";

test("the complete verification and password recovery API surface is registered", () => {
  const paths = new Set(
    (authRouter as unknown as { stack: Array<{ route?: { path: string } }> }).stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => Boolean(path)),
  );
  for (const path of [
    "/auth/register",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/login",
    "/auth/logout",
    "/auth/me",
  ]) assert.equal(paths.has(path), true, `${path} should be registered`);
});

test("public registration stays closed without both release flags", async () => {
  const previousOpen = process.env.RENOVA_REGISTRATION_OPEN;
  const previousApproved = process.env.RENOVA_BETA_RELEASE_APPROVED;
  const previousProvider = process.env.RENOVA_EMAIL_PROVIDER;
  delete process.env.RENOVA_REGISTRATION_OPEN;
  delete process.env.RENOVA_BETA_RELEASE_APPROVED;
  delete process.env.RENOVA_EMAIL_PROVIDER;
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Registration is not open yet" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousOpen === undefined) delete process.env.RENOVA_REGISTRATION_OPEN; else process.env.RENOVA_REGISTRATION_OPEN = previousOpen;
    if (previousApproved === undefined) delete process.env.RENOVA_BETA_RELEASE_APPROVED; else process.env.RENOVA_BETA_RELEASE_APPROVED = previousApproved;
    if (previousProvider === undefined) delete process.env.RENOVA_EMAIL_PROVIDER; else process.env.RENOVA_EMAIL_PROVIDER = previousProvider;
  }
});
