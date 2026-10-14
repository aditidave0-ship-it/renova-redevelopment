import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../lib/db/src/schema/index";
export const engine = new PGlite();
export const db = drizzle(engine, { schema });
export const pool = null;
export const requireDb = () => db;
export * from "../../../lib/db/src/schema/index";
