/**
 * LEGACY — Postgres / Cloud SQL pool (NOT the primary database).
 *
 * Architecture decision (2026-10): Primary DB = Cloudflare D1 only + Google Sheets.
 * Runtime sync/read path uses src/db/d1-snapshot.ts and line-server-fn (activeBackend: "d1" | "memory").
 *
 * This module is retained only so existing imports (db-service, drizzle tools) do not break.
 * Do not use for new features. Do not point production traffic here.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

function readEnv(key: string): string | undefined {
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    const val = g.process?.env?.[key];
    return typeof val === "string" ? val : undefined;
  } catch {
    return undefined;
  }
}

export const createPool = () => {
  if (!globalThis._postgresPool) {
    const host =
      readEnv("SQL_HOST") ||
      (readEnv("INSTANCE_CONNECTION_NAME")
        ? `/cloudsql/${readEnv("INSTANCE_CONNECTION_NAME")}`
        : undefined);
    const user =
      readEnv("SQL_USER") ||
      readEnv("SQL_ADMIN_USER") ||
      readEnv("DB_USER") ||
      readEnv("PGUSER");
    const password =
      readEnv("SQL_PASSWORD") ||
      readEnv("SQL_ADMIN_PASSWORD") ||
      readEnv("DB_PASSWORD") ||
      readEnv("PGPASSWORD");
    const database =
      readEnv("SQL_DB_NAME") ||
      readEnv("DB_NAME") ||
      readEnv("PGDATABASE") ||
      "postgres";

    globalThis._postgresPool = new Pool({
      host,
      user,
      password,
      database,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    globalThis._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return globalThis._postgresPool;
};

/** Lazy accessor — avoids top-level process.env on client bundles */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
function getDb() {
  if (!_db) {
    _db = drizzle(createPool(), { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
