#!/usr/bin/env node
/**
 * Read-only health smoke check for an explicitly selected local RENOVA API.
 *
 * Usage: node artifacts/api-server/tests/check-local-health.mjs http://127.0.0.1:3000
 * No credentials or production data are read or written.
 */
const candidate = process.argv[2];
if (!candidate) {
  console.error("Usage: node check-local-health.mjs http://127.0.0.1:<port>");
  process.exitCode = 2;
} else {
  let url;
  try {
    url = new URL(candidate);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.protocol !== "http:" || !loopback || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Only an HTTP loopback origin with path / is permitted");
    }
  } catch {
    console.error("Refusing target: provide an http://127.0.0.1:<port>/ loopback origin (no credentials, path, or query).");
    process.exit(2);
  }

  const checks = [
    { path: "/api/healthz", expected: "ok" },
    { path: "/api/readyz", expected: "ready" },
  ];
  let failed = false;
  for (const check of checks) {
    try {
      const response = await fetch(new URL(check.path, url), {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { accept: "application/json" },
      });
      const body = await response.json();
      if (response.status === 200 && body?.status === check.expected) {
        console.log("PASS " + check.path + ": " + check.expected);
      } else {
        failed = true;
        console.error("FAIL " + check.path + ": HTTP " + response.status + ", status=" + String(body?.status ?? "missing"));
      }
    } catch (error) {
      failed = true;
      console.error("FAIL " + check.path + ": " + (error instanceof Error ? error.message : "request error"));
    }
  }
  if (failed) {
    console.error("Local API is not fully ready. Do not infer staging or production readiness from this check.");
    process.exitCode = 1;
  } else {
    console.log("Local liveness and schema readiness passed. External services and authenticated journeys remain unverified.");
  }
}
