import { defineConfig } from "drizzle-kit";

/**
 * Drizzle config for Cloudflare D1 (SQLite).
 * Local migrations: `npx wrangler d1 migrations apply mom-and-pop-shop-db --local`
 * Remote:          `npx wrangler d1 migrations apply mom-and-pop-shop-db --remote`
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "",
    databaseId: process.env["CLOUDFLARE_D1_DATABASE_ID"] ?? "18b3a79c-40d8-4008-8aae-79e56ab61330",
    token: process.env["CLOUDFLARE_API_TOKEN"] ?? "",
  },
  verbose: true,
});
