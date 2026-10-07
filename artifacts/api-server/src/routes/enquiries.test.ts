import assert from "node:assert/strict";
import test from "node:test";
import enquiriesRouter, { enquirySchema } from "./enquiries";

function routeMethods(router: unknown) {
  return (
    router as {
      stack: Array<{
        route?: { path: string; methods: Record<string, boolean> };
      }>;
    }
  ).stack
    .filter((layer) => layer.route)
    .map(
      (layer) =>
        `${Object.keys(layer.route!.methods)[0].toUpperCase()} ${layer.route!.path}`,
    );
}

const validEnquiry = {
  name: "Society Secretary",
  organizationName: "Example Cooperative Housing Society",
  email: "SECRETARY@EXAMPLE.COM",
  phone: "+91 98765 43210",
  city: "Mumbai",
  actorType: "Housing Society" as const,
  message: "Please help us understand how to begin a feasibility review.",
  consent: true as const,
};

test("public submission and protected admin enquiry routes are registered", () => {
  const routes = routeMethods(enquiriesRouter);
  assert.equal(routes.includes("POST /enquiries"), true);
  assert.equal(routes.includes("GET /admin/enquiries"), true);
});

test("website remains the default enquiry source", () => {
  const result = enquirySchema.parse(validEnquiry);
  assert.equal(result.source, "WEBSITE");
  assert.equal(result.email, "secretary@example.com");
});

test("feasibility enquiries are tagged for the admin list", () => {
  const result = enquirySchema.parse({
    ...validEnquiry,
    source: "FEASIBILITY",
  });
  assert.equal(result.source, "FEASIBILITY");
});

test("unknown enquiry sources are rejected", () => {
  const result = enquirySchema.safeParse({
    ...validEnquiry,
    source: "UNTRUSTED_SOURCE",
  });
  assert.equal(result.success, false);
});
