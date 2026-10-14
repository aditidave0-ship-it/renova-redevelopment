import type { PortfolioEntry, ProfileCredential } from "@workspace/db";

type CompletionRole = "SOCIETY" | "DEVELOPER" | "PMC";

export function assertOrganizationOwnership(currentOrganizationId: string | null, targetOrganizationId: string): void {
  if (!currentOrganizationId || currentOrganizationId !== targetOrganizationId) {
    const error = new Error("You do not have permission to access this profile");
    Object.assign(error, { status: 403 });
    throw error;
  }
}

function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

export function profileCompletion(role: CompletionRole, profile: Record<string, unknown>) {
  const fields = role === "SOCIETY"
    ? ["organizationName", "location", "address", "unitCount", "redevelopmentStatus", "description"]
    : role === "DEVELOPER"
      ? ["organizationName", "description", "website", "officeLocation", "areasServed", "specializations", "publicEmail", "portfolio"]
      : ["organizationName", "description", "officeLocation", "locationsServed", "services", "specializations", "publicEmail", "teamInformation"];
  const completed = fields.filter((field) => present(profile[field])).length;
  return { completed, total: fields.length, percent: Math.round((completed / fields.length) * 100) };
}

function publicCredentials(credentials: ProfileCredential[] | null | undefined) {
  return (credentials ?? []).filter((item) => item.isPublic).map(({ name, issuer, reference }) => ({ name, issuer, reference }));
}

export function developerMarketplaceProfile(profile: {
  organizationId: string; organizationName: string; role: string; logoUrl: string | null; description: string | null;
  website: string | null; publicEmail: string | null; publicPhone: string | null; officeLocation: string | null;
  areasServed: string[]; specializations: string[]; teamInformation: string | null; portfolio: PortfolioEntry[];
  credentials: ProfileCredential[]; marketplaceVisible: boolean;
}) {
  if (!profile.marketplaceVisible) return null;
  return {
    organizationId: profile.organizationId, organizationName: profile.organizationName, role: profile.role,
    logoUrl: profile.logoUrl, description: profile.description, website: profile.website,
    publicEmail: profile.publicEmail, publicPhone: profile.publicPhone, officeLocation: profile.officeLocation,
    areasServed: profile.areasServed, specializations: profile.specializations, teamInformation: profile.teamInformation,
    portfolio: profile.portfolio, credentials: publicCredentials(profile.credentials),
  };
}

export function pmcMarketplaceProfile(profile: {
  organizationId: string; organizationName: string; role: string; logoUrl: string | null; description: string | null;
  website: string | null; publicEmail: string | null; publicPhone: string | null; officeLocation: string | null;
  locationsServed: string[]; services: string[]; specializations: string[]; teamInformation: string | null;
  portfolio: PortfolioEntry[]; credentials: ProfileCredential[]; marketplaceVisible: boolean;
}) {
  if (!profile.marketplaceVisible) return null;
  return {
    organizationId: profile.organizationId, organizationName: profile.organizationName, role: profile.role,
    logoUrl: profile.logoUrl, description: profile.description, website: profile.website,
    publicEmail: profile.publicEmail, publicPhone: profile.publicPhone, officeLocation: profile.officeLocation,
    locationsServed: profile.locationsServed, services: profile.services, specializations: profile.specializations,
    teamInformation: profile.teamInformation, portfolio: profile.portfolio, credentials: publicCredentials(profile.credentials),
  };
}

export function societyMarketplaceProfile(profile: {
  organizationName: string; location: string | null; city: string; numberBuildings: number | null; numberWings: number | null;
  unitCount: number | null; propertyType: string | null; landArea: string | null; redevelopmentStatus: string | null;
  description: string | null; marketplaceVisible: boolean;
}) {
  if (!profile.marketplaceVisible) return null;
  return {
    organizationName: profile.organizationName, location: profile.location, city: profile.city,
    numberBuildings: profile.numberBuildings, numberWings: profile.numberWings, unitCount: profile.unitCount,
    propertyType: profile.propertyType, landArea: profile.landArea, redevelopmentStatus: profile.redevelopmentStatus,
    description: profile.description,
  };
}
