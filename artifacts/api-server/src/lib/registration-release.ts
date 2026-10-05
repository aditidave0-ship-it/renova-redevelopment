/** Release evidence is reviewed in Git, never inferred from a health response. */
export const requiredChecks = ["apiRolesAndIsolation", "desktopAndMobile", "emailVerification", "passwordResetAndDelivery"] as const;
type Check = typeof requiredChecks[number];
export type RegistrationRelease = {
  approvalId: string;
  expiresAt: string;
  checks: Record<Check, { passed: boolean; evidence: string }>;
};

// Intentionally closed. Replace only through a reviewed release PR after testing.
export const registrationRelease: RegistrationRelease = {
  approvalId: "",
  expiresAt: "",
  checks: {
    apiRolesAndIsolation: { passed: true, evidence: "https://github.com/aditidave0-ship-it/renova-redevelopment/pull/21" },
    desktopAndMobile: { passed: false, evidence: "" },
    emailVerification: { passed: false, evidence: "" },
    passwordResetAndDelivery: { passed: false, evidence: "" },
  },
};

export function isPublicRegistrationOpen(
  env: Record<string, string | undefined>,
  release: RegistrationRelease = registrationRelease,
  now = Date.now(),
): boolean {
  if (env.RENOVA_REGISTRATION_OPEN !== "true") return false;
  if (!release.approvalId || env.RENOVA_REGISTRATION_APPROVAL_ID !== release.approvalId) return false;
  const expiry = Date.parse(release.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  return requiredChecks.every((key) => {
    const check = release.checks?.[key];
    if (check?.passed !== true) return false;
    try {
      const url = new URL(check.evidence);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  });
}
