import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: "./drizzle",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL ? { dbCredentials: { url: process.env.DATABASE_URL } } : {}),
});
