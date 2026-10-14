import { build } from "esbuild";
import { resolve } from "node:path";
import { mkdtemp, rm, symlink, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

if (process.env.VERCEL_ENV === "production" || process.env.DATABASE_URL)
  throw new Error("Staging runner refuses production/external database configuration");
const mode = process.argv[2];
if (!["--check", "--serve"].includes(mode))
  throw new Error("Use --check for acceptance, or --serve for local browser fixtures");
const folder = await mkdtemp(resolve(tmpdir(), "renova-controlled-staging-"));
await chmod(folder, 0o700);
const require = createRequire(import.meta.url);
Object.assign(process.env, {
  RENOVA_ISOLATED_FIXTURE_DIRECTORY: folder,
  RENOVA_AUTH_TOKEN_SECRET: randomBytes(48).toString("base64url"),
  RENOVA_REGISTRATION_TEST_TOKEN: randomBytes(48).toString("base64url"),
  RENOVA_EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "TEST-ONLY-intercepted-no-external-delivery",
  RENOVA_PRODUCT_NAME: "RENOVA — ISOLATED TEST ONLY",
  RENOVA_EMAIL_FROM: "TEST ONLY <sandbox@example.invalid>",
  RENOVA_ADMIN_ENQUIRY_EMAIL: "controlled-admin@example.invalid",
  RENOVA_REGISTRATION_OPEN: "false",
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
  RENOVA_STAGING_MODE: mode,
});
// Prevent ambient storage/payment credentials being used by a fixture process.
for (const key of ["BLOB_READ_WRITE_TOKEN", "BLOB_PRIVATE_READ_WRITE_TOKEN", "RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET", "RAZORPAY_TEST_WEBHOOK_SECRET", "RENOVA_PAYMENTS_MODE"])
  delete process.env[key];
try {
  const outfile = resolve(folder, "staging.mjs");
  await build({
    entryPoints: ["tests/staging.ts"], outfile, bundle: true,
    platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-staging", setup(build) {
      build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve("tests/staging-database.ts") }));
      build.onResolve({ filter: /^\.\/database$/ }, () => ({ path: resolve("tests/staging-database.ts") }));
      build.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve("../../lib/api-zod/src/index.ts") }));
      build.onResolve({ filter: /^zod(\/.*)?$/ }, ({ path }) => ({ path: require.resolve(path, { paths: [resolve("../../lib/api-zod")] }) }));
    }}],
  });
  await symlink(resolve("node_modules"), resolve(folder, "node_modules"), "dir");
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(folder, { recursive: true, force: true });
}
