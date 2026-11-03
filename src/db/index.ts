/**
 * Postgres pool — primary on Railway when SQL_HOST / DATABASE_URL is set.
 *
 * Architecture (2026-10-30):
 * - Railway production: Postgres primary + Google Sheets backup
 * - Cloudflare Workers: D1 path still available via d1-snapshot (optional)
 * - Fallback: in-process memory when neither is configured
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
    return typeof val === "string" && val.length > 0 ? val : undefined;
  } catch {
    return undefined;
  }
}

/** True when Railway/SQL env is present (does not open a connection). */
export function isPostgresConfigured(): boolean {
  if (readEnv("DATABASE_URL")) return true;
  const host = readEnv("SQL_HOST") || readEnv("PGHOST");
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
  return Boolean(host && user && password);
}

export const createPool = () => {
  if (!globalThis._postgresPool) {
    const databaseUrl = readEnv("DATABASE_URL");
    if (databaseUrl) {
      globalThis._postgresPool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        connectionTimeoutMillis: 15000,
        // Railway internal network typically does not require SSL
        ssl: databaseUrl.includes("localhost") ? false : undefined,
      });
    } else {
      const host =
        readEnv("SQL_HOST") ||
        readEnv("PGHOST") ||
        (readEnv("INSTANCE_CONNECTION_NAME")
          ? `/cloudsql/${readEnv("INSTANCE_CONNECTION_NAME")}`
          : undefined);
      const portRaw = readEnv("SQL_PORT") || readEnv("PGPORT");
      const port = portRaw ? Number(portRaw) : 5432;
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
        port: Number.isFinite(port) ? port : 5432,
        user,
        password,
        database,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    globalThis._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return globalThis._postgresPool;
};

function createMockDb(): ReturnType<typeof drizzle<typeof schema>> {
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: { data?: unknown }) => d?.data ?? {},
    update: async (d: { data?: unknown }) => d?.data ?? {},
    delete: async () => ({}),
  };

  const createChainable = (terminalValue: unknown = []): unknown => {
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(terminalValue);
        }
        return (..._args: unknown[]) => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler);
  };

  return new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get(_t, prop) {
      if (prop === "query") {
        return new Proxy({}, { get: () => noOp });
      }
      if (prop === "execute") {
        return async () => ({ rows: [] });
      }
      if (prop === "transaction") {
        return async (cb: (tx: unknown) => unknown) => cb(createMockDb());
      }
      return () => createChainable([]);
    },
  });
}

/** Lazy accessor — avoids top-level process.env on client bundles */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    if (!isPostgresConfigured()) {
      console.warn("[AI Studio] Database not configured — using in-memory mock");
      _db = createMockDb();
    } else {
      try {
        _db = drizzle(createPool(), { schema });
      } catch (err) {
        console.warn("[AI Studio] Database connection failed — using in-memory mock", err);
        _db = createMockDb();
      }
    }
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
