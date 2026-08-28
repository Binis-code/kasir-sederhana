import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL?.startsWith("file:")
      ? process.env.DATABASE_URL
      : "file:kios_nusa.db",
  },
});
