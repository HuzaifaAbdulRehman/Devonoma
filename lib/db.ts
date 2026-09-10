import { Pool } from "pg";

import { requiredEnv } from "./config";

const globalForDatabase = globalThis as typeof globalThis & {
  devonomaPool?: Pool;
};

export function getDatabase(): Pool {
  const database =
    globalForDatabase.devonomaPool ??
    new Pool({
      connectionString: requiredEnv("DATABASE_URL"),
      max: 5,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.devonomaPool = database;
  }

  return database;
}
