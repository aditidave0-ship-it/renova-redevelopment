import assert from "node:assert/strict";
import { and, desc, eq, isNull } from "drizzle-orm";
import { authTokens, authRateLimits, db, users } from "./database";
import {
  REGISTRATION_PARTICIPANTS,
  registrationIdentity,
} from "../src/lib/role-policy";
import { hashPassword } from "../src/lib/session";
import {
  issueAuthToken,
  issueEmailOtp,
  issueLoginOtp,
} from "../src/lib/auth-tokens";

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
  const request = (
    path: string,
    body: unknown,
    controlled = false,
    cookie = "",
    method = "POST",
  ) =>
    nativeFetch(origin + "/api" + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(controlled
          ? { "x-renova-registration-test": "TEST-ONLY-local-registration" }
          : {}),
      },
      body: JSON.stringify(body),
    });
  function deliveredToken(
    email: string,
    purpose: "verify" | "reset" | "login",
  ): string {
    const message = [...sent]
      .reverse()
      .find(
        (row) =>
          row.to.includes(email) &&
          (purpose === "verify"
            ? /verification code is \d{6}/.test(row.text)
            : purpose === "login"
              ? /sign-in code is \d{6}/.test(row.text)
              : row.text.includes("#reset=")),
      );
    assert.ok(message, "isolated provider must receive the intended template");
    checks++;
    if (purpose === "verify")
      return message.text.match(/verification code is (\d{6})/)![1];
    if (purpose === "login")
      return message.text.match(/sign-in code is (\d{6})/)![1];
    const link = message.text.match(/https:\/\/\S+/)?.[0];
    assert.ok(link);
    checks++;
    assert.equal(new URL(link).origin, "https://qa.example.invalid");
    checks++;
    return decodeURIComponent(new URL(link).hash.slice(purpose.length + 2));
  }
  async function loginWithOtp(email: string, password: string) {
    await db.delete(authRateLimits);
    const initiated = await request("/auth/login", { email, password });
    assert.equal(initiated.status, 202);
    checks++;
    assert.equal(
      initiated.headers.get("set-cookie"),
      null,
      "password verification alone must not create a session",
    );
    checks++;
    const otp = deliveredToken(email, "login");
    const wrongOtp = otp === "000000" ? "000001" : "000000";
    assert.equal(
      (await request("/auth/verify-login", { email, otp: wrongOtp })).status,
      400,
    );
    checks++;
    const verified = await request("/auth/verify-login", { email, otp });
    assert.equal(verified.status, 200);
    checks++;
    assert.ok(
      verified.headers.get("set-cookie"),
      "a session is created after OTP verification",
    );
    checks++;
    assert.equal(
      (await request("/auth/verify-login", { email, otp })).status,
      400,
      "a consumed OTP cannot be replayed",
    );
    checks++;
    return verified;
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
            participantType: "PMC",
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

    let resetUserCookie = "";
    for (const role of REGISTRATION_PARTICIPANTS) {
      // Keep the intentional IP-wide production limit from coupling separate
      // test accounts; the isolated request still exercises account limits.
      await db.delete(authRateLimits);
      const email = `controlled-${role.toLowerCase()}@example.invalid`;
      const registration = await request(
        "/auth/register",
        {
          email,
          password: "test-password-valid",
          displayName: `TEST ONLY ${role}`,
          participantType: role,
          organizationName: `TEST ONLY ${role}`,
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
        (await request("/auth/verify-email", { email, otp: token })).status,
        200,
      );
      checks++;
      assert.equal(
        (await request("/auth/verify-email", { email, otp: token })).status,
        400,
      );
      checks++;
      assert.equal(
        (
          await request(
            "/auth/register",
            {
              email,
              password: "test-password-valid",
              displayName: "TEST ONLY duplicate",
              participantType: role,
              organizationName: "TEST ONLY duplicate",
            },
            true,
          )
        ).status,
        409,
      );
      checks++;
      const login = await loginWithOtp(email, "test-password-valid");
      checks++;
      const sessionHeader = login.headers.get("set-cookie") ?? "";
      for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax"]) {
        assert.ok(
          sessionHeader.includes(attribute),
          "production-labelled sessions require secure cookie attributes",
        );
        checks++;
      }
      assert.equal(
        ((await login.json()) as any).user.role,
        registrationIdentity(role).role,
      );
      checks++;
      const sessionCookie = (login.headers.get("set-cookie") ?? "").split(
        ";",
      )[0];
      if (role === "SOCIETY") {
        assert.equal(
          (await request("/auth/me", undefined, false, sessionCookie, "GET"))
            .status,
          200,
        );
        checks++;
        assert.equal(
          (await request("/auth/logout", undefined, false, sessionCookie))
            .status,
          204,
        );
        checks++;
        assert.equal(
          (await request("/auth/me", undefined, false, sessionCookie, "GET"))
            .status,
          401,
        );
        checks++;
      }
      if (role === "PMC") resetUserCookie = sessionCookie;
      const deliveredCount = sent.length;
      assert.equal(
        (await request("/auth/resend-login-otp", { email })).status,
        202,
      );
      checks++;
      assert.equal(
        sent.length,
        deliveredCount,
        "resend cooldown does not send a second code",
      );
      checks++;
      const [verifiedUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      await db
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.userId, verifiedUser.id),
            eq(authTokens.purpose, "LOGIN_OTP"),
          ),
        );
    }

    const [expiredUser] = await db
      .insert(users)
      .values({
        email: "expired-login-otp@example.invalid",
        displayName: "TEST ONLY expired login OTP",
        role: "SOCIETY",
        passwordHash: hashPassword("test-password-valid"),
        isActive: true,
        emailVerifiedAt: new Date(),
      })
      .returning();
    const expiredLogin = issueLoginOtp(
      expiredUser.id,
      new Date(Date.now() - 6 * 60_000),
    );
    await db.insert(authTokens).values({
      userId: expiredUser.id,
      purpose: "LOGIN_OTP",
      tokenHash: expiredLogin.tokenHash,
      expiresAt: expiredLogin.expiresAt,
      failedAttempts: 0,
    });
    assert.equal(
      (
        await request("/auth/verify-login", {
          email: expiredUser.email,
          otp: expiredLogin.otp,
        })
      ).status,
      400,
      "expired login OTPs are rejected",
    );
    checks++;
    const attemptLogin = issueLoginOtp(expiredUser.id);
    await db.insert(authTokens).values({
      userId: expiredUser.id,
      purpose: "LOGIN_OTP",
      tokenHash: attemptLogin.tokenHash,
      expiresAt: attemptLogin.expiresAt,
      failedAttempts: 0,
    });
    const wrongOtp = attemptLogin.otp === "000000" ? "000001" : "000000";
    for (let attempt = 0; attempt < 6; attempt++) {
      assert.equal(
        (
          await request("/auth/verify-login", {
            email: expiredUser.email,
            otp: wrongOtp,
          })
        ).status,
        400,
      );
      checks++;
    }
    const [attemptRecord] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, expiredUser.id),
          eq(authTokens.purpose, "LOGIN_OTP"),
        ),
      )
      .orderBy(desc(authTokens.createdAt))
      .limit(1);
    assert.equal(
      attemptRecord.failedAttempts,
      5,
      "login OTP attempts stop at the configured maximum",
    );
    checks++;
    assert.equal(
      (
        await request("/auth/verify-login", {
          email: expiredUser.email,
          otp: attemptLogin.otp,
        })
      ).status,
      400,
    );
    checks++;

    await db.delete(authRateLimits);
    const badPasswords = await Promise.all(
      Array.from({ length: 11 }, () =>
        request("/auth/login", {
          email: expiredUser.email,
          password: "incorrect-test-password",
        }),
      ),
    );
    assert.deepEqual(
      badPasswords.map((response) => response.status),
      [...Array(10).fill(401), 429],
    );
    checks++;

    await db.delete(authRateLimits);
    const [resendUser] = await db
      .insert(users)
      .values({
        email: "login-resend@example.invalid",
        displayName: "TEST ONLY login resend",
        role: "SOCIETY",
        passwordHash: hashPassword("test-password-valid"),
        isActive: true,
        emailVerifiedAt: new Date(),
      })
      .returning();
    const sentBeforeUnauthorizedResend = sent.length;
    assert.equal(
      (await request("/auth/resend-login-otp", { email: resendUser.email }))
        .status,
      202,
    );
    checks++;
    assert.equal(sent.length, sentBeforeUnauthorizedResend);
    checks++;
    assert.equal(
      (
        await db
          .select()
          .from(authTokens)
          .where(
            and(
              eq(authTokens.userId, resendUser.id),
              eq(authTokens.purpose, "LOGIN_OTP"),
            ),
          )
      ).length,
      0,
    );
    checks++;
    await db.delete(authRateLimits);
    assert.equal(
      (
        await request("/auth/login", {
          email: resendUser.email,
          password: "test-password-valid",
        })
      ).status,
      202,
    );
    checks++;
    const originalLoginCode = deliveredToken(resendUser.email, "login");
    const [originalLoginToken] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, resendUser.id),
          eq(authTokens.purpose, "LOGIN_OTP"),
          isNull(authTokens.usedAt),
        ),
      );
    const sentBeforeCooldownResend = sent.length;
    assert.equal(
      (await request("/auth/resend-login-otp", { email: resendUser.email }))
        .status,
      202,
    );
    checks++;
    assert.equal(sent.length, sentBeforeCooldownResend);
    checks++;
    await db
      .update(authTokens)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(authTokens.id, originalLoginToken.id));
    assert.equal(
      (await request("/auth/resend-login-otp", { email: resendUser.email }))
        .status,
      202,
    );
    checks++;
    assert.equal(sent.length, sentBeforeCooldownResend + 1);
    checks++;
    const resentLoginCode = deliveredToken(resendUser.email, "login");
    if (resentLoginCode !== originalLoginCode) {
      assert.equal(
        (
          await request("/auth/verify-login", {
            email: resendUser.email,
            otp: originalLoginCode,
          })
        ).status,
        400,
      );
      checks++;
    }
    const resentLogin = await request("/auth/verify-login", {
      email: resendUser.email,
      otp: resentLoginCode,
    });
    assert.equal(resentLogin.status, 200);
    checks++;
    assert.ok(resentLogin.headers.get("set-cookie"));
    checks++;

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
    const protectedSecret = process.env.RENOVA_AUTH_TOKEN_SECRET;
    delete process.env.RENOVA_AUTH_TOKEN_SECRET;
    try {
      const known = await request("/auth/resend-verification", {
        email: pending.email,
      });
      const unknown = await request("/auth/resend-verification", {
        email: "secret-preflight-unknown@example.invalid",
      });
      assert.equal(known.status, 503);
      checks++;
      assert.equal(unknown.status, 503);
      checks++;
      assert.deepEqual(await known.json(), await unknown.json());
      checks++;
      assert.equal(
        (
          await db
            .select()
            .from(authTokens)
            .where(eq(authTokens.userId, pending.id))
        ).length,
        0,
      );
      checks++;
    } finally {
      process.env.RENOVA_AUTH_TOKEN_SECRET = protectedSecret;
    }
    sent.length = 0;
    const resends = await Promise.all(
      Array.from({ length: 6 }, () =>
        request("/auth/resend-verification", { email: pending.email }),
      ),
    );
    assert.equal(resends.filter((row) => row.status === 202).length, 3);
    checks++;
    assert.equal(resends.filter((row) => row.status === 429).length, 3);
    checks++;
    await db.delete(authRateLimits); // Isolated DB: test the persisted cooldown separately.
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
      (
        await db
          .select()
          .from(authTokens)
          .where(eq(authTokens.id, pendingTokens[0].id))
      ).length,
      0,
    );
    checks++;
    const replacementCode = deliveredToken(pending.email, "verify");
    if (firstVerification !== replacementCode) {
      assert.equal(
        (
          await request("/auth/verify-email", {
            email: pending.email,
            otp: firstVerification,
          })
        ).status,
        400,
      );
      checks++;
    }
    assert.equal(
      (
        await request("/auth/verify-email", {
          email: pending.email,
          otp: deliveredToken(pending.email, "verify"),
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
    assert.equal(resets.filter((row) => row.status === 202).length, 5);
    checks++;
    assert.equal(resets.filter((row) => row.status === 429).length, 1);
    checks++;
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
      (await request("/auth/me", undefined, false, resetUserCookie, "GET"))
        .status,
      401,
      "password reset invalidates existing sessions",
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
      (await loginWithOtp(resetEmail, "test-reset-password")).status,
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

    const [attemptUser] = await db
      .insert(users)
      .values({
        email: "attempts@example.invalid",
        displayName: "TEST ONLY attempts",
        role: "SOCIETY",
        passwordHash: hashPassword("test-password-valid"),
        isActive: false,
      })
      .returning();
    const issued = issueEmailOtp(attemptUser.id);
    await db.insert(authTokens).values({
      userId: attemptUser.id,
      purpose: "EMAIL_VERIFICATION",
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    const wrong = issued.otp === "000000" ? "000001" : "000000";
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        request("/auth/verify-email", { email: attemptUser.email, otp: wrong }),
      ),
    );
    assert.deepEqual(
      attempts.map((row) => row.status),
      [400, 400, 400, 400, 400, 400],
    );
    checks++;
    assert.equal(
      (
        await db
          .select()
          .from(authTokens)
          .where(eq(authTokens.userId, attemptUser.id))
      )[0].failedAttempts,
      5,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/verify-email", {
          email: attemptUser.email,
          otp: issued.otp,
        })
      ).status,
      400,
    );
    checks++;
    await db.delete(authTokens).where(eq(authTokens.userId, attemptUser.id));
    const expired = issueEmailOtp(
      attemptUser.id,
      new Date(Date.now() - 11 * 60_000),
    );
    await db.insert(authTokens).values({
      userId: attemptUser.id,
      purpose: "EMAIL_VERIFICATION",
      tokenHash: expired.tokenHash,
      expiresAt: expired.expiresAt,
    });
    assert.equal(
      (
        await request("/auth/verify-email", {
          email: attemptUser.email,
          otp: expired.otp,
        })
      ).status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/verify-email", {
          email: "unknown-otp@example.invalid",
          otp: "123456",
        })
      ).status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request(
          "/auth/register",
          {
            email: "admin-signup@example.invalid",
            password: "test-password-valid",
            displayName: "TEST ONLY admin",
            participantType: "ADMIN",
            organizationName: "TEST ONLY",
          },
          true,
        )
      ).status,
      400,
    );
    checks++;

    return checks;
  } finally {
    globalThis.fetch = nativeFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
