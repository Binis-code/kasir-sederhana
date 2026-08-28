import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema.js";

const dbUrl = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL
  : "file:kios_nusa.db";

const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });

export async function closePool() {
  client.close();
}