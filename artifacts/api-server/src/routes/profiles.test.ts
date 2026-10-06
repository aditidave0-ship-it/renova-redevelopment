import assert from "node:assert/strict";
import test from "node:test";
import profilesRouter from "./profiles";
import opportunitiesRouter from "./opportunities";

function routeMethods(router: unknown) {
  return (router as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route!.methods)[0].toUpperCase()} ${layer.route!.path}`);
}

test("profile ownership, preview, and marketplace routes are registered", () => {
  assert.deepEqual(routeMethods(profilesRouter), [
    "GET /profiles/me",
    "PUT /profiles/me",
    "GET /profiles/me/preview",
    "GET /marketplace/organizations/:id",
  ]);
});

test("opportunity detail, interest tracking, and society review routes are registered", () => {
  const routes = routeMethods(opportunitiesRouter);
  for (const route of [
    "GET /opportunities",
    "GET /opportunities/:id",
    "POST /opportunities/:id/interests",
    "GET /organizations/me/interests",
    "GET /societies/me/interests",
    "PATCH /societies/me/interests/:id",
  ]) assert.equal(routes.includes(route), true, `${route} should be registered`);
});
