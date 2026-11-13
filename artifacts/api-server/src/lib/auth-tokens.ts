import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export type AuthTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "LOGIN_OTP";

const TOKEN_LIFETIME_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 10 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
  LOGIN_OTP: 5 * 60 * 1000,
};

export const EMAIL_OTP_MAX_ATTEMPTS = 5;

function otpSecret(): string {
  const value = process.env.RENOVA_AUTH_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) {
    const error = new Error(
      "Authentication token protection is not configured",
    );
    Object.assign(error, {
      status: 503,
      code: "AUTH_TOKEN_SECRET_UNAVAILABLE",
    });
    throw error;
  }
  return value;
}

export function ensureEmailOtpConfigured(): void {
  otpSecret();
}

export function hashEmailOtp(
  userId: string,
  otp: string,
  secret = otpSecret(),
): string {
  return createHmac("sha256", secret)
    .update(`EMAIL_VERIFICATION:${userId}:${otp}`)
    .digest("hex");
}

export function issueEmailOtp(
  userId: string,
  now = new Date(),
  secret = otpSecret(),
) {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return {
    otp,
    tokenHash: hashEmailOtp(userId, otp, secret),
    expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS.EMAIL_VERIFICATION),
  };
}

export function verifyEmailOtpHash(
  userId: string,
  otp: string,
  expectedHash: string,
  secret = otpSecret(),
): boolean {
  const actual = Buffer.from(hashEmailOtp(userId, otp, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashLoginOtp(userId: string, otp: string, secret = otpSecret()): string {
  return createHmac("sha256", secret).update(`LOGIN_OTP:${userId}:${otp}`).digest("hex");
}

export function issueLoginOtp(userId: string, now = new Date(), secret = otpSecret()) {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { otp, tokenHash: hashLoginOtp(userId, otp, secret), expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS.LOGIN_OTP) };
}

export function verifyLoginOtpHash(userId: string, otp: string, expectedHash: string, secret = otpSecret()): boolean {
  const actual = Buffer.from(hashLoginOtp(userId, otp, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueAuthToken(purpose: AuthTokenPurpose, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashAuthToken(token),
    expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS[purpose]),
  };
}

export function isUsableAuthToken(
  token: {
    purpose: AuthTokenPurpose;
    expiresAt: Date;
    usedAt: Date | null;
    failedAttempts?: number;
  },
  expectedPurpose: AuthTokenPurpose,
  now = new Date(),
): boolean {
  return (
    token.purpose === expectedPurpose &&
    token.usedAt === null &&
    token.expiresAt.getTime() > now.getTime() &&
    (!(expectedPurpose === "EMAIL_VERIFICATION" || expectedPurpose === "LOGIN_OTP") ||
      (token.failedAttempts ?? 0) < EMAIL_OTP_MAX_ATTEMPTS)
  );
}
