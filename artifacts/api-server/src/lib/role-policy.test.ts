import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardPath,
  REGISTRATION_PARTICIPANTS,
  registrationIdentity,
} from "./role-policy";

test("ADMIN is never exposed as a public registration participant", () => {
  assert.equal(REGISTRATION_PARTICIPANTS.includes("ADMIN" as never), false);
});

test("professional participant types share one secure account role", () => {
  assert.deepEqual(registrationIdentity("ARCHITECT"), {
    role: "PROFESSIONAL",
    professionalType: "ARCHITECT",
  });
  assert.deepEqual(registrationIdentity("ADVOCATE_LEGAL"), {
    role: "PROFESSIONAL",
    professionalType: "ADVOCATE_LEGAL",
  });
  assert.deepEqual(registrationIdentity("OTHER_PROFESSIONAL"), {
    role: "PROFESSIONAL",
    professionalType: "OTHER",
  });
});

test("each account role resolves to its own dashboard", () => {
  assert.equal(dashboardPath("SOCIETY"), "/dashboard/society");
  assert.equal(dashboardPath("DEVELOPER"), "/dashboard/developer");
  assert.equal(dashboardPath("PMC"), "/dashboard/pmc");
  assert.equal(dashboardPath("PROFESSIONAL"), "/dashboard/professional");
});
