import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const migrationFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

export async function migrateProduction() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url || !process.env.DATABASE_URL) {
    throw new Error("RENOVA production database variables are missing.");
  }

  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: migrationFolder });
    console.log("RENOVA production database migration completed.");
  } catch {
    // Connection errors can include credentials. Never print the underlying error.
    throw new Error("RENOVA production database migration failed; details withheld to protect credentials.");
  } finally {
    await pool.end();
  }
}
