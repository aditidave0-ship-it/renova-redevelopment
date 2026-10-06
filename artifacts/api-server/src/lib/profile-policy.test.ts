import assert from "node:assert/strict";
import test from "node:test";
import { assertOrganizationOwnership, developerMarketplaceProfile, profileCompletion, societyMarketplaceProfile } from "./profile-policy";

test("profile edits require the authenticated organization", () => {
  assert.doesNotThrow(() => assertOrganizationOwnership("org-a", "org-a"));
  assert.throws(() => assertOrganizationOwnership("org-a", "org-b"), /permission/);
  assert.throws(() => assertOrganizationOwnership(null, "org-b"), /permission/);
});

test("developer marketplace output excludes private credentials and unknown fields", () => {
  const output = developerMarketplaceProfile({
    organizationId: "org-a", organizationName: "Example Developer", role: "DEVELOPER", logoUrl: null,
    description: "Factual profile", website: null, publicEmail: null, publicPhone: null, officeLocation: null,
    areasServed: [], specializations: [], teamInformation: null, portfolio: [], marketplaceVisible: true,
    credentials: [{ name: "Public registration", reference: "PUBLIC-1", isPublic: true }, { name: "Private file", reference: "SECRET-1", isPublic: false }],
  });
  assert.deepEqual(output?.credentials, [{ name: "Public registration", issuer: undefined, reference: "PUBLIC-1" }]);
  assert.equal(Object.hasOwn(output ?? {}, "accountEmail"), false);
});

test("hidden society profiles and contact fields are never exposed to the marketplace", () => {
  const output = societyMarketplaceProfile({
    organizationName: "Example Society", location: "Mumbai", city: "Mumbai", numberBuildings: 2, numberWings: 4,
    unitCount: 80, propertyType: "Co-operative housing society", landArea: null, redevelopmentStatus: "Exploring",
    description: "Public summary", marketplaceVisible: false,
  });
  assert.equal(output, null);
});

test("profile completion is factual and allows optional fields to remain empty", () => {
  assert.deepEqual(profileCompletion("SOCIETY", { organizationName: "A", location: "Mumbai", address: "Street", unitCount: 50 }), { completed: 4, total: 6, percent: 67 });
});
