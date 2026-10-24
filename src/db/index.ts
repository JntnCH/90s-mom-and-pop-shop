import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const host =
      process.env["SQL_HOST"] ||
      (process.env["INSTANCE_CONNECTION_NAME"]
        ? `/cloudsql/${process.env["INSTANCE_CONNECTION_NAME"]}`
        : undefined);
    const user =
      process.env["SQL_USER"] ||
      process.env["SQL_ADMIN_USER"] ||
      process.env["DB_USER"] ||
      process.env["PGUSER"];
    const password =
      process.env["SQL_PASSWORD"] ||
      process.env["SQL_ADMIN_PASSWORD"] ||
      process.env["DB_PASSWORD"] ||
      process.env["PGPASSWORD"];
    const database =
      process.env["SQL_DB_NAME"] ||
      process.env["DB_NAME"] ||
      process.env["PGDATABASE"] ||
      "postgres";

    global._postgresPool = new Pool({
      host,
      user,
      password,
      database,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
export { schema };
