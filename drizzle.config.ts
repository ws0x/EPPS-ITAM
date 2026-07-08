import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations run DDL, which is more reliable outside the transaction
    // pooler — prefer the direct connection when available.
    url: (process.env.DIRECT_URL || process.env.DATABASE_URL)!,
  },
  strict: true,
  verbose: true,
});
