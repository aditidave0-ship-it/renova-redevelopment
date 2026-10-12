export const REGISTRATION_PARTICIPANTS = [
  "SOCIETY",
  "DEVELOPER",
  "PMC",
  "ADVOCATE_LEGAL",
  "ARCHITECT",
  "STRUCTURAL_CONSULTANT",
  "VALUATION_FINANCE",
  "OTHER_PROFESSIONAL",
] as const;

export type RegistrationParticipant =
  (typeof REGISTRATION_PARTICIPANTS)[number];
export type PublicAccountRole =
  "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL";
export type ProfessionalType =
  | "ADVOCATE_LEGAL"
  | "ARCHITECT"
  | "STRUCTURAL_CONSULTANT"
  | "VALUATION_FINANCE"
  | "OTHER";

export function registrationIdentity(participant: RegistrationParticipant): {
  role: PublicAccountRole;
  professionalType: ProfessionalType | null;
} {
  if (
    participant === "SOCIETY" ||
    participant === "DEVELOPER" ||
    participant === "PMC"
  ) {
    return { role: participant, professionalType: null };
  }
  return {
    role: "PROFESSIONAL",
    professionalType:
      participant === "OTHER_PROFESSIONAL" ? "OTHER" : participant,
  };
}

export function dashboardPath(role: PublicAccountRole | "ADMIN"): string {
  switch (role) {
    case "SOCIETY":
      return "/dashboard/society";
    case "DEVELOPER":
      return "/dashboard/developer";
    case "PMC":
      return "/dashboard/pmc";
    case "PROFESSIONAL":
      return "/dashboard/professional";
    case "ADMIN":
      return "/dashboard/admin";
  }
}
