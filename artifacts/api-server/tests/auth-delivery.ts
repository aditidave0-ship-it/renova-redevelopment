import assert from "node:assert/strict";
import { and, eq, isNull } from "drizzle-orm";
import { authTokens, db, users } from "./database";
import { hashPassword } from "../src/lib/session";
import { issueAuthToken } from "../src/lib/auth-tokens";

// Isolated route/database acceptance only. Intercept the external email provider,
// never authentication or database responses, and never send test emails out.
export async function testAuthDelivery(origin: string): Promise<number> {
  const nativeFetch = globalThis.fetch;
  const keys = [
    "NODE_ENV",
    "RENOVA_EMAIL_PROVIDER",
    "RESEND_API_KEY",
    "RENOVA_APP_URL",
    "RENOVA_EMAIL_FROM",
    "RENOVA_REGISTRATION_TEST_TOKEN",
    "RENOVA_REGISTRATION_OPEN",
    "RENOVA_BETA_RELEASE_APPROVED",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const sent: Array<{ to: string[]; text: string }> = [];
  let rejectDelivery = false;
  let checks = 0;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === "https://api.resend.com/emails") {
      if (rejectDelivery) throw new Error("TEST ONLY provider unavailable");
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "TEST-ONLY-delivery" });
    }
    return nativeFetch(input, init);
  };
  const request = (path: string, body: unknown, controlled = false) =>
    nativeFetch(origin + "/api" + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(controlled
          ? { "x-renova-registration-test": "TEST-ONLY-local-registration" }
          : {}),
      },
      body: JSON.stringify(body),
    });
  function deliveredToken(email: string, purpose: "verify" | "reset"): string {
    const message = sent.find(
      (row) => row.to.includes(email) && row.text.includes(`#${purpose}=`),
    );
    assert.ok(
      message,
      "the isolated provider must receive the intended template",
    );
    checks++;
    const link = message.text.match(/https:\/\/\S+/)?.[0];
    assert.ok(link);
    checks++;
    assert.equal(new URL(link).origin, "https://qa.example.invalid");
    checks++;
    return decodeURIComponent(new URL(link).hash.slice(purpose.length + 2));
  }
  try {
    process.env.NODE_ENV = "production";
    process.env.RENOVA_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "TEST-ONLY-no-real-provider-key";
    process.env.RENOVA_APP_URL = "https://qa.example.invalid";
    process.env.RENOVA_EMAIL_FROM = "TEST ONLY <no-mail@example.invalid>";
    process.env.RENOVA_REGISTRATION_TEST_TOKEN = "TEST-ONLY-local-registration";
    delete process.env.RENOVA_REGISTRATION_OPEN;
    delete process.env.RENOVA_BETA_RELEASE_APPROVED;

    assert.equal((await request("/auth/register", {})).status, 503);
    checks++;
    // An eligible locally controlled registration must not write a user when
    // sender/origin configuration is invalid.
    delete process.env.RENOVA_APP_URL;
    const invalidBrandEmail = "invalid-brand@example.invalid";
    assert.equal(
      (
        await request(
          "/auth/register",
          {
            email: invalidBrandEmail,
            password: "test-password-valid",
            displayName: "TEST ONLY invalid brand",
            role: "PMC",
            organizationName: "TEST ONLY invalid brand",
          },
          true,
        )
      ).status,
      503,
    );
    checks++;
    assert.equal(
      (await db.select().from(users).where(eq(users.email, invalidBrandEmail)))
        .length,
      0,
    );
    checks++;
    assert.equal(sent.length, 0);
    checks++;
    process.env.RENOVA_APP_URL = "https://qa.example.invalid";

    for (const role of [
      "SOCIETY",
      "DEVELOPER",
      "PMC",
      "PROFESSIONAL",
    ] as const) {
      const email = `controlled-${role.toLowerCase()}@example.invalid`;
      const registration = await request(
        "/auth/register",
        {
          email,
          password: "test-password-valid",
          displayName: `TEST ONLY ${role}`,
          role,
          organizationName: `TEST ONLY ${role}`,
          ...(role === "PROFESSIONAL" ? { specialization: "ARCHITECT" } : {}),
        },
        true,
      );
      assert.equal(registration.status, 202);
      checks++;
      assert.equal(registration.headers.get("set-cookie"), null);
      checks++;
      assert.equal(
        (
          await request("/auth/login", {
            email,
            password: "test-password-valid",
          })
        ).status,
        401,
      );
      checks++;
      const token = deliveredToken(email, "verify");
      assert.equal(
        (await request("/auth/verify-email", { token })).status,
        200,
      );
      checks++;
      assert.equal(
        (await request("/auth/verify-email", { token })).status,
        400,
      );
      checks++;
      const login = await request("/auth/login", {
        email,
        password: "test-password-valid",
      });
      assert.equal(login.status, 200);
      checks++;
      assert.equal(((await login.json()) as any).user.role, role);
      checks++;
    }

    const [pending] = await db
      .insert(users)
      .values({
        email: "resend-concurrent@example.invalid",
        displayName: "TEST ONLY concurrent resend",
        role: "PROFESSIONAL",
        passwordHash: hashPassword("test-password-valid"),
        isActive: false,
      })
      .returning();
    sent.length = 0;
    const resends = await Promise.all(
      Array.from({ length: 6 }, () =>
        request("/auth/resend-verification", { email: pending.email }),
      ),
    );
    for (const response of resends) {
      assert.equal(response.status, 202);
      checks++;
    }
    assert.equal(
      sent.length,
      1,
      "concurrent resend requests must send only one usable link",
    );
    checks++;
    const pendingTokens = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, pending.id),
          eq(authTokens.purpose, "EMAIL_VERIFICATION"),
          isNull(authTokens.usedAt),
        ),
      );
    assert.equal(pendingTokens.length, 1);
    checks++;
    const firstVerification = deliveredToken(pending.email, "verify");
    assert.equal(
      (await request("/auth/resend-verification", { email: pending.email }))
        .status,
      202,
    );
    checks++;
    assert.equal(sent.length, 1);
    checks++;
    await db
      .update(authTokens)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(authTokens.id, pendingTokens[0].id));
    sent.length = 0;
    assert.equal(
      (await request("/auth/resend-verification", { email: pending.email }))
        .status,
      202,
    );
    checks++;
    assert.equal(
      sent.length,
      1,
      "resend becomes available when the persisted cooldown expires",
    );
    checks++;
    assert.equal(
      (await request("/auth/verify-email", { token: firstVerification }))
        .status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/verify-email", {
          token: deliveredToken(pending.email, "verify"),
        })
      ).status,
      200,
    );
    checks++;

    sent.length = 0;
    const resetEmail = "controlled-pmc@example.invalid";
    const resets = await Promise.all(
      Array.from({ length: 6 }, () =>
        request("/auth/forgot-password", { email: resetEmail }),
      ),
    );
    for (const response of resets) {
      assert.equal(response.status, 202);
      checks++;
    }
    assert.equal(
      sent.length,
      1,
      "concurrent reset requests must respect the persisted cooldown",
    );
    checks++;
    const resetToken = deliveredToken(resetEmail, "reset");
    assert.equal(
      (
        await request("/auth/reset-password", {
          token: resetToken,
          password: "test-reset-password",
        })
      ).status,
      200,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/reset-password", {
          token: resetToken,
          password: "test-reset-password",
        })
      ).status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/login", {
          email: resetEmail,
          password: "test-password-valid",
        })
      ).status,
      401,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/login", {
          email: resetEmail,
          password: "test-reset-password",
        })
      ).status,
      200,
    );
    checks++;

    const [disabled] = await db
      .select()
      .from(users)
      .where(eq(users.email, "controlled-developer@example.invalid"));
    await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, disabled.id));
    sent.length = 0;
    for (const endpoint of [
      "/auth/resend-verification",
      "/auth/forgot-password",
    ]) {
      const known = await request(endpoint, { email: disabled.email });
      const unknown = await request(endpoint, {
        email: "unknown@example.invalid",
      });
      assert.equal(known.status, 202);
      checks++;
      assert.equal(unknown.status, 202);
      checks++;
      assert.deepEqual(await known.json(), await unknown.json());
      checks++;
    }
    assert.equal(sent.length, 0);
    checks++;
    const oldReset = issueAuthToken("PASSWORD_RESET");
    await db.insert(authTokens).values({
      userId: disabled.id,
      purpose: "PASSWORD_RESET",
      tokenHash: oldReset.tokenHash,
      expiresAt: oldReset.expiresAt,
    });
    assert.equal(
      (
        await request("/auth/reset-password", {
          token: oldReset.token,
          password: "must-not-change-password",
        })
      ).status,
      400,
    );
    checks++;

    await db.insert(users).values({
      email: "provider-failure@example.invalid",
      displayName: "TEST ONLY delivery failure",
      role: "SOCIETY",
      passwordHash: hashPassword("test-password-valid"),
      isActive: false,
    });
    rejectDelivery = true;
    for (const [endpoint, email] of [
      ["/auth/resend-verification", "provider-failure@example.invalid"],
      ["/auth/forgot-password", "controlled-society@example.invalid"],
    ]) {
      const known = await request(endpoint, { email });
      const unknown = await request(endpoint, {
        email: "unknown@example.invalid",
      });
      assert.equal(known.status, 202);
      checks++;
      assert.equal(unknown.status, 202);
      checks++;
      assert.deepEqual(await known.json(), await unknown.json());
      checks++;
    }
    return checks;
  } finally {
    globalThis.fetch = nativeFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
