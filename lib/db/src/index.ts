import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Keep the web server bootable for static/frontend-only deployments. Database-backed
// routes call requireDb() and return a clear configuration error until DATABASE_URL
// is provisioned in the environment.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
export const db = pool ? drizzle(pool, { schema }) : null;
export type AppDb = NonNullable<typeof db>;

export function requireDb(): AppDb {
  if (!db) {
    const error = new Error("DATABASE_URL is not configured");
    Object.assign(error, { status: 503 });
    throw error;
  }
  return db;
}

export * from "./schema";
