#!/usr/bin/env node
/**
 * Rebuild src/lib/line-server-fn.ts from a known-good baseline + D1 patches.
 * Used when the file on main was accidentally truncated.
 * Soft-skips when the file is already D1-ready.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "src/lib/line-server-fn.ts";
let src = readFileSync(path, "utf8");

const alreadyD1 =
  src.includes("isD1Available") ||
  src.includes("syncD1Payload") ||
  src.includes("Prefer Cloudflare D1") ||
  src.includes("Primary Database: Cloudflare D1");

if (alreadyD1) {
  console.log("line-server-fn already D1-ready — skip apply-d1 patches");
  process.exit(0);
}

if (!src.includes("getD1Snapshot")) {
  const oldImport =
    'import { getDatabaseSnapshot, syncDatabasePayload } from "../db/db-service.ts";';
  const newImport = `import { getDatabaseSnapshot, syncDatabasePayload } from "../db/db-service.ts";
import { getD1Snapshot } from "../db/d1-snapshot.ts";`;
  if (!src.includes(oldImport)) {
    console.warn("baseline import not found — skip import patch");
  } else {
    src = src.replace(oldImport, newImport);
  }
}

if (!src.includes("Prefer Cloudflare D1") && !src.includes("Primary Database: Cloudflare D1")) {
  const marker = `  .handler(async ({ data }) => {
    // 1. If Cloud SQL credentials are set, sync with PostgreSQL
    if (process.env["SQL_HOST"] && process.env["SQL_USER"] && process.env["SQL_PASSWORD"]) {`;
  const replacement = `  .handler(async ({ data }) => {
    // 0. Prefer Cloudflare D1 when binding is available (LINE / Workers path)
    try {
      const d1Snapshot = await getD1Snapshot();
      if (d1Snapshot && Array.isArray(d1Snapshot.products) && d1Snapshot.products.length > 0) {
        const clientProducts = data.products;
        const useClientProducts =
          Array.isArray(clientProducts) &&
          clientProducts.length > 0 &&
          clientProducts.length >= d1Snapshot.products.length;
        const products = useClientProducts ? clientProducts : d1Snapshot.products;
        const categories =
          data.categories && data.categories.length > 0 ? data.categories : d1Snapshot.categories;
        const units = data.units && data.units.length > 0 ? data.units : d1Snapshot.units;
        const zones = data.zones && data.zones.length > 0 ? data.zones : d1Snapshot.zones;
        const subCategories =
          data.subCategories && data.subCategories.length > 0
            ? data.subCategories
            : d1Snapshot.subCategories;

        globalServerDatabase.products = products;
        globalServerDatabase.categories = categories;
        globalServerDatabase.units = units;
        globalServerDatabase.zones = zones;
        globalServerDatabase.subCategories = subCategories;
        globalServerDatabase.lastUpdated = new Date().toISOString();

        return {
          success: true,
          data: {
            products,
            categories,
            units,
            zones,
            subCategories,
            purchaseOrders: globalServerDatabase.purchaseOrders || [],
            movements: globalServerDatabase.movements || [],
            receives: globalServerDatabase.receives || [],
            followers: globalServerDatabase.followers || [],
          },
          lastUpdated: globalServerDatabase.lastUpdated,
          source: "d1",
        };
      }
    } catch (d1Err) {
      console.warn("D1 snapshot unavailable, trying other backends:", d1Err);
    }

    // 1. If Cloud SQL credentials are set, sync with PostgreSQL
    if (process.env["SQL_HOST"] && process.env["SQL_USER"] && process.env["SQL_PASSWORD"]) {`;
  if (!src.includes(marker)) {
    console.warn("sync marker not found — skip sync patch (file may already be customized)");
  } else {
    src = src.replace(marker, replacement);
  }
}

if (!src.includes("fetchCloudSqlSnapshotFn: D1 failed")) {
  const oldFetch = `export const fetchCloudSqlSnapshotFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const snapshot = await getDatabaseSnapshot();
    return {
      success: true,
      data: snapshot,
      source: "d1" as const,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: globalServerDatabase,
      source: "memory" as const,
    };
  }
});`;
  const oldFetch2 = oldFetch.replace('source: "d1" as const', 'source: "cloudsql" as const');
  const newFetch = `export const fetchCloudSqlSnapshotFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const d1Snapshot = await getD1Snapshot();
    if (d1Snapshot && d1Snapshot.products.length > 0) {
      globalServerDatabase.products = d1Snapshot.products;
      globalServerDatabase.categories = d1Snapshot.categories;
      globalServerDatabase.units = d1Snapshot.units;
      globalServerDatabase.zones = d1Snapshot.zones;
      globalServerDatabase.subCategories = d1Snapshot.subCategories;
      globalServerDatabase.lastUpdated = new Date().toISOString();
      return {
        success: true,
        data: d1Snapshot,
        source: "d1" as const,
      };
    }
  } catch (d1Err) {
    console.warn("fetchCloudSqlSnapshotFn: D1 failed:", d1Err);
  }

  try {
    const snapshot = await getDatabaseSnapshot();
    return {
      success: true,
      data: snapshot,
      source: "cloudsql" as const,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: globalServerDatabase,
      source: "memory" as const,
    };
  }
});`;
  if (src.includes(oldFetch)) src = src.replace(oldFetch, newFetch);
  else if (src.includes(oldFetch2)) src = src.replace(oldFetch2, newFetch);
  else {
    console.warn("fetch block not found — skip fetch patch");
  }
}

writeFileSync(path, src);
console.log("patched", path, "bytes", src.length);
