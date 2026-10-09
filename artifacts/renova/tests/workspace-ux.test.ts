import test from "node:test";
import assert from "node:assert/strict";
import {
  participantRoles,
  participantFor,
  publicSignupEnabled,
  professionalSpecialization,
} from "../src/experience/roles";
import { workspaceApi, WorkspaceApiError } from "../src/platform/workspace-api";
test("public participant choices retain distinct roles and never grant ADMIN", () => {
  assert.equal(participantRoles.length, 8);
  assert.deepEqual(
    new Set(participantRoles.map((item) => item.role)),
    new Set(["SOCIETY", "DEVELOPER", "PMC", "PROFESSIONAL"]),
  );
  for (const id of ["legal", "architect", "structural", "finance", "other"])
    assert.equal(participantFor(id).role, "PROFESSIONAL");
  assert.equal(participantFor("pmc").role, "PMC");
  assert.equal(participantFor("ADMIN").role, "SOCIETY");
  assert.equal(publicSignupEnabled, false);
  assert.equal(professionalSpecialization("architect"), "ARCHITECT");
  assert.equal(professionalSpecialization("finance"), "FINANCE_VALUATION");
  assert.equal(professionalSpecialization("developer"), undefined);
});
test("API requests retain same-origin cookies and surface only confirmed JSON success", async () => {
  const original = globalThis.fetch;
  let observed: RequestInit | undefined;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/enquiries");
    observed = init;
    return new Response(JSON.stringify({ reference: "QA-LOCAL-ONLY" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    assert.deepEqual(
      await workspaceApi("/enquiries", { method: "POST", body: "{}" }),
      { reference: "QA-LOCAL-ONLY" },
    );
    assert.equal(observed?.credentials, "same-origin");
    assert.equal(observed?.method, "POST");
  } finally {
    globalThis.fetch = original;
  }
});
test("logout accepts the API's empty 204 response without leaving the client signed in", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/auth/logout");
      assert.equal(init?.method, "POST");
      assert.equal(init?.credentials, "same-origin");
      return new Response(null, { status: 204 });
    };
    assert.equal(await workspaceApi<void>("/auth/logout", { method: "POST" }), undefined);
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(
      workspaceApi<void>("/auth/logout", { method: "POST" }),
      (error) => error instanceof WorkspaceApiError && error.status === 401,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("missing, forbidden, unavailable and non-JSON services cannot be reported as success", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [403, 404, 500]) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: "Not available" }), {
          status,
          headers: { "content-type": "application/json" },
        });
      await assert.rejects(
        workspaceApi("/societies/me/feasibility"),
        (error) =>
          error instanceof WorkspaceApiError && error.status === status,
      );
    }
    globalThis.fetch = async () =>
      new Response("<html>SPA fallback</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    await assert.rejects(
      workspaceApi("/organizations/me"),
      (error) => error instanceof WorkspaceApiError && error.status === 502,
    );
  } finally {
    globalThis.fetch = original;
  }
});
