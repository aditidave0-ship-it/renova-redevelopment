export const participantRoles = [
  {
    id: "society",
    role: "SOCIETY",
    label: "Society / Property Owner",
    description: "Plan your society’s next chapter.",
    profileLabel: "Society / property name",
  },
  {
    id: "developer",
    role: "DEVELOPER",
    label: "Developer",
    description: "Discover redevelopment opportunities.",
    profileLabel: "Company name",
  },
  {
    id: "pmc",
    role: "PMC",
    label: "PMC",
    description: "Support societies through redevelopment.",
    profileLabel: "PMC organization name",
  },
  {
    id: "legal",
    role: "PROFESSIONAL",
    label: "Advocate / Legal Professional",
    description: "Offer legal expertise.",
    profileLabel: "Practice / organization name",
  },
  {
    id: "architect",
    role: "PROFESSIONAL",
    label: "Architect",
    description: "Offer architectural services.",
    profileLabel: "Studio / organization name",
  },
  {
    id: "structural",
    role: "PROFESSIONAL",
    label: "Structural Consultant",
    description: "Offer structural expertise.",
    profileLabel: "Practice / organization name",
  },
  {
    id: "finance",
    role: "PROFESSIONAL",
    label: "Financial / Valuation Professional",
    description: "Offer financial and valuation services.",
    profileLabel: "Practice / organization name",
  },
  {
    id: "other",
    role: "PROFESSIONAL",
    label: "Other Professional",
    description: "Offer redevelopment services.",
    profileLabel: "Practice / organization name",
  },
] as const;
export function participantFor(id: string | null) {
  return participantRoles.find((item) => item.id === id) ?? participantRoles[0];
}
// This presentation gate stays closed until the production acceptance milestone is approved.
// The server independently enforces registration eligibility; a URL or frontend flag cannot open it.
export const publicSignupEnabled = false;
