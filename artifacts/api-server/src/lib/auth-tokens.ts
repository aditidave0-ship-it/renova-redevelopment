import { createHash, randomBytes } from "node:crypto";

export type AuthTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

const TOKEN_LIFETIME_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

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
  token: { purpose: AuthTokenPurpose; expiresAt: Date; usedAt: Date | null },
  expectedPurpose: AuthTokenPurpose,
  now = new Date(),
): boolean {
  return (
    token.purpose === expectedPurpose &&
    token.usedAt === null &&
    token.expiresAt.getTime() > now.getTime()
  );
}
