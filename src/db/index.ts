import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

export type AppDatabase = DrizzleD1Database<typeof schema>;

let _db: AppDatabase | undefined;

/**
 * Resolve the D1 binding named `DB` (see wrangler.jsonc).
 * Works on Cloudflare Workers (nodejs_compat) via `cloudflare:workers`.
 */
function resolveD1(): D1Database {
  // 1) Explicit test/injection hook
  const g = globalThis as typeof globalThis & {
    __D1_DB__?: D1Database;
  };
  if (g.__D1_DB__) return g.__D1_DB__;

  // 2) Official Workers module binding
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cf = require("cloudflare:workers") as { env?: { DB?: D1Database } };
    if (cf?.env?.DB) return cf.env.DB;
  } catch {
    // not running inside Workers
  }

  throw new Error(
    "D1 binding `DB` is not available. Ensure wrangler.jsonc binds database mom-and-pop-shop-db as DB and deploy to Cloudflare Workers.",
  );
}

export function createDb(d1: D1Database): AppDatabase {
  return drizzle(d1, { schema });
}

export function getDb(d1?: D1Database): AppDatabase {
  if (d1) {
    _db = createDb(d1);
    return _db;
  }
  if (_db) return _db;
  _db = createDb(resolveD1());
  return _db;
}

/**
 * Back-compat singleton used by existing services (`import { db } from "./index"`).
 * Lazily resolves the D1 binding on first access.
 */
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
