import assert from "node:assert/strict";
import test from "node:test";
import feasibilityRouter from "./feasibility";

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

test("society and authorized admin feasibility routes are registered", () => {
  const routes = routeMethods(feasibilityRouter);
  for (const route of [
    "GET /feasibility/me",
    "POST /feasibility",
    "GET /feasibility/:id",
    "PUT /feasibility/:id",
    "POST /feasibility/:id/submit",
    "POST /feasibility/:id/documents",
    "GET /feasibility/:id/documents/:documentId",
    "GET /admin/feasibility",
    "GET /admin/feasibility/:id",
    "PATCH /admin/feasibility/:id/status",
    "PUT /admin/feasibility/:id/assessment",
    "POST /admin/feasibility/:id/publish",
  ])
    assert.equal(routes.includes(route), true, `${route} should be registered`);
});
