import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Do not connect during builds; fail explicitly when an actual query is attempted.
const databaseUrl = process.env.DATABASE_URL;
let connection: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required to access PostgreSQL");
  connection ??= drizzle(new Pool({ connectionString: databaseUrl, max: 5 }), { schema });
  return connection;
}
