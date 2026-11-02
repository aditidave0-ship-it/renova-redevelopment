export type RequirementEnquiryDetails = {
  societyName: string;
  location: string;
  societyType: string;
  memberCount: number;
  buildingAge: number;
  landType?: string;
  plotArea?: number;
  conveyanceStatus?: string;
  structuralAudit?: string;
  services: string[];
  timeline: string;
  brief?: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  consent: boolean;
};

export function buildRequirementEnquiryPayload(
  details: RequirementEnquiryDetails,
) {
  if (!details.consent)
    throw new Error("Consent is required to submit an enquiry.");
  return {
    name: details.contactName,
    organizationName: details.societyName,
    email: details.email,
    phone: details.phone,
    city: details.location,
    actorType: "Housing Society" as const,
    experienceYears: null,
    consent: true as const,
    message: [
      "Society redevelopment requirement enquiry",
      `Society type: ${details.societyType}`,
      `Member households: ${details.memberCount}`,
      `Building age: ${details.buildingAge} years`,
      `Land tenure: ${details.landType ?? "Not provided"}`,
      `Approximate plot area: ${details.plotArea ?? "Not provided"}`,
      `Conveyance status: ${details.conveyanceStatus ?? "Not provided"}`,
      `Structural audit: ${details.structuralAudit ?? "Not provided"}`,
      `Services requested: ${details.services.join(", ")}`,
      `Preferred timeline: ${details.timeline}`,
      `Committee contact role: ${details.contactRole}`,
      `Additional information: ${details.brief ?? "Not provided"}`,
    ].join("\n"),
  };
}

export async function sendRequirementEnquiry(
  details: RequirementEnquiryDetails,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher("/api/enquiries", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildRequirementEnquiryPayload(details)),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.reference !== "string")
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "Your enquiry could not be saved. Please try again later.",
    );
  return result.reference;
}
