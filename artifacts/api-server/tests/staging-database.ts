import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../lib/db/src/schema/index";
import { resolve, basename } from "node:path";
import { tmpdir } from "node:os";

// This module is an esbuild alias used ONLY by the staging test runner.
// Production builds always resolve @workspace/db to the real workspace package.
const root = process.env.RENOVA_ISOLATED_FIXTURE_DIRECTORY;
if (
  process.env.VERCEL_ENV === "production" ||
  process.env.DATABASE_URL ||
  !root ||
  !basename(root).startsWith("renova-controlled-staging-") ||
  resolve(root, "..") !== resolve(tmpdir())
)
  throw new Error("Isolated staging refuses production or external database configuration");

export const engine = new PGlite(resolve(root, "database"));
export const db = drizzle(engine, { schema });
export const pool = null;
export const requireDb = () => db;
export * from "../../../lib/db/src/schema/index";
