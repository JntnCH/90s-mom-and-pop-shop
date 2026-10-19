import { createServerFn } from "@tanstack/react-start";
import {
  createMiniAppPortalFlexBubble,
  DEFAULT_STORE_NAME,
  getSystemStoreName,
} from "./flex-templates";
import { getDatabaseSnapshot, syncDatabasePayload } from "../db/db-service.ts";
import { getD1Snapshot } from "../db/d1-snapshot.ts";
import { removeLegacySampleLineFollowers } from "./line-follower-data";
import type {
  CategoryItem,
  LineUserFollower,
  ProductItem,
  PurchaseOrderRecord,
  ReceiveItem,
  SubCategoryItem,
  StockMovementLog,
  UnitItem,
  ZoneItem,
} from "./store";

export type LineMessageSendFormat = "FLEX" | "IMAGE_PNG" | "BOTH";

export interface SendLineOrderPayload {
  toUserIdOrGroupId?: string | undefined;
  orderSummary: string;
  flexMessage?: unknown;
  imageBase64?: string | undefined;
  imageUrl?: string | undefined;
  format?: LineMessageSendFormat | undefined;
  channelAccessToken?: string | undefined;
  isBroadcast?: boolean;
}

export interface ServerLineFollower {
  userId: string;
  displayName: string;
  pictureUrl?: string | null | undefined;
  statusMessage?: string | null | undefined;
  followedAt: string;
  lastInteractionAt: string;
  role: "admin" | "staff" | "viewer";
}

export interface ServerSyncPayload {
  lastUpdated?: string | undefined;
  products?: ProductItem[] | undefined;
  categories?: CategoryItem[] | undefined;
  subCategories?: SubCategoryItem[] | undefined;
  deletedSubCategoryIds?: string[] | undefined;
  zones?: ZoneItem[] | undefined;
  units?: UnitItem[] | undefined;
  receives?: ReceiveItem[] | undefined;
  followers?: LineUserFollower[] | undefined;
  movements?: StockMovementLog[] | undefined;
  purchaseOrders?: PurchaseOrderRecord[] | undefined;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type DatabaseSnapshot = Awaited<ReturnType<typeof getDatabaseSnapshot>>;
type DatabaseFollower = DatabaseSnapshot["followers"][number];
type SnapshotPurchaseOrder = Omit<DatabaseSnapshot["purchaseOrders"][number], "items"> & {
  items: JsonValue[];
};

const globalServerDatabase: {
  lastUpdated: string;
  products?: ProductItem[] | DatabaseSnapshot["products"] | undefined;
  categories?: CategoryItem[] | DatabaseSnapshot["categories"] | undefined;
  subCategories?: SubCategoryItem[] | DatabaseSnapshot["subCategories"] | undefined;
  zones?: ZoneItem[] | DatabaseSnapshot["zones"] | undefined;
  units?: UnitItem[] | DatabaseSnapshot["units"] | undefined;
  receives?: ReceiveItem[] | DatabaseSnapshot["receives"] | undefined;
  followers: (ServerLineFollower | DatabaseFollower)[];
  movements?: StockMovementLog[] | DatabaseSnapshot["movements"] | undefined;
  purchaseOrders?: PurchaseOrderRecord[] | SnapshotPurchaseOrder[] | undefined;
} = {
  lastUpdated: new Date().toISOString(),
  subCategories: [],
  followers: [],
};

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") return Object.values(value).every(isJsonValue);
  return false;
}

export const DEFAULT_LINE_LIFF_ID = "2011710264-gaZ7oEcK";

function getLineChannelAccessToken(): string {
  return (
    process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
    process.env["LINE_ACCESS_TOKEN"] ||
    process.env["LINE_TOKEN"] ||
    process.env["CHANNEL_ACCESS_TOKEN"] ||
    process.env["ACCESS_TOKEN"] ||
    process.env["LINE_BOT_TOKEN"] ||
    process.env["LINE_MESSAGING_TOKEN"] ||
    ""
  ).trim();
}

export const getLineServerConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const envLiff = (
    process.env["LINE_LIFF_ID"] ||
    process.env["VITE_LINE_LIFF_ID"] ||
    process.env["LIFF_ID"] ||
    process.env["LINE_LIFF"] ||
    process.env["LIFFID"] ||
    process.env["VITE_LIFF_ID"] ||
    ""
  ).trim();
  const validLiff = envLiff && envLiff !== "xxxxx-xxxxx" ? envLiff : DEFAULT_LINE_LIFF_ID;
  const hasAccessToken = Boolean(getLineChannelAccessToken());
  return {
    hasChannelId: Boolean(process.env["LINE_CHANNEL_ID"] || process.env["CHANNEL_ID"]),
    hasChannelSecret: Boolean(
      process.env["LINE_CHANNEL_SECRET"] ||
        process.env["CHANNEL_SECRET"] ||
        process.env["LINE_SECRET"],
    ),
    hasAccessToken,
    hasServerLiffId: Boolean(validLiff),
    configuredLiffId: validLiff,
    hasLineToId: Boolean(
      process.env["LINE_TO_ID"] ||
        process.env["LINE_TARGET_ID"] ||
        process.env["LINE_USER_ID"] ||
        process.env["LINE_RECEIVER_ID"],
    ),
  };
});

export const syncMasterDatabaseFn = createServerFn({ method: "POST" })
  .validator((payload: ServerSyncPayload) => payload)
  .handler(async ({ data }) => {
    // Prefer Cloudflare D1 when binding is available (LINE / Workers path)
    try {
      const d1Snapshot = await getD1Snapshot();
      if (d1Snapshot && Array.isArray(d1Snapshot.products) && d1Snapshot.products.length > 0) {
        const clientProducts = data.products;
        const useClientProducts =
          Array.isArray(clientProducts) &&
          clientProducts.length > 0 &&
          clientProducts.length >= d1Snapshot.products.length;
        const products = useClientProducts ? clientProducts! : d1Snapshot.products;
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

    if (process.env["SQL_HOST"] && process.env["SQL_USER"] && process.env["SQL_PASSWORD"]) {
      try {
        const sqlSnapshot = await syncDatabasePayload({
          ...(data.units === undefined
            ? {}
            : { units: data.units.map(({ id, name, shortName }) => ({ id, name, shortName })) }),
          ...(data.categories === undefined
            ? {}
            : {
                categories: data.categories.map(({ id, code, name }) => ({ id, code, name })),
              }),
          ...(data.subCategories === undefined
            ? {}
            : {
                subCategories: data.subCategories.map(({ id, categoryId, code, name }) => ({
                  id,
                  categoryId,
                  code,
                  name,
                })),
              }),
          ...(data.deletedSubCategoryIds === undefined
            ? {}
            : { deletedSubCategoryIds: data.deletedSubCategoryIds }),
          ...(data.zones === undefined
            ? {}
            : {
                zones: data.zones.map(({ id, code, name, description }) => ({
                  id,
                  code,
                  name,
                  ...(description === undefined ? {} : { description }),
                })),
              }),
          ...(data.products === undefined ? {} : { products: data.products }),
          ...(data.purchaseOrders === undefined ? {} : { purchaseOrders: data.purchaseOrders }),
          ...(data.movements === undefined
            ? {}
            : {
                movements: data.movements.map((movement) => ({
                  id: movement.id,
                  timestamp: movement.timestamp,
                  productId: movement.productId,
                  productName: movement.productName,
                  barcode: movement.barcode,
                  type: movement.type,
                  quantity: movement.quantity,
                  previousStock: movement.previousStock,
                  newStock: movement.newStock,
                  operator: movement.operator,
                  ...(movement.note === undefined ? {} : { note: movement.note }),
                })),
              }),
          ...(data.receives === undefined
            ? {}
            : {
                receives: data.receives.map((receive) => ({
                  id: receive.id,
                  barcode: receive.barcode,
                  codeType: receive.codeType,
                  ...(receive.format === undefined ? {} : { format: receive.format }),
                  productName: receive.productName,
                  unit: receive.unit,
                  quantity: receive.quantity,
                  scannedAt: receive.scannedAt,
                })),
              }),
          followers: removeLegacySampleLineFollowers(data.followers).map((follower) => ({
            userId: follower.userId,
            displayName: follower.displayName,
            ...(follower.pictureUrl === undefined ? {} : { pictureUrl: follower.pictureUrl }),
            ...(follower.statusMessage === undefined
              ? {}
              : { statusMessage: follower.statusMessage }),
            ...(follower.role === undefined ? {} : { role: follower.role }),
            ...(follower.followedAt === undefined ? {} : { followedAt: follower.followedAt }),
            ...(follower.lastInteractionAt === undefined
              ? {}
              : { lastInteractionAt: follower.lastInteractionAt }),
          })),
        });

        const syncedFollowers = removeLegacySampleLineFollowers(sqlSnapshot.followers);
        const serializedPurchaseOrders: SnapshotPurchaseOrder[] = sqlSnapshot.purchaseOrders.map(
          (purchaseOrder) => ({
            ...purchaseOrder,
            items: purchaseOrder.items.filter(isJsonValue),
          }),
        );
        const sanitizedSnapshot = {
          ...sqlSnapshot,
          followers: syncedFollowers,
          purchaseOrders: serializedPurchaseOrders,
        };

        globalServerDatabase.products = sqlSnapshot.products;
        globalServerDatabase.categories = sqlSnapshot.categories;
        globalServerDatabase.subCategories = sqlSnapshot.subCategories;
        globalServerDatabase.zones = sqlSnapshot.zones;
        globalServerDatabase.units = sqlSnapshot.units;
        globalServerDatabase.receives = sqlSnapshot.receives;
        globalServerDatabase.followers = syncedFollowers;
        globalServerDatabase.movements = sqlSnapshot.movements;
        globalServerDatabase.purchaseOrders = serializedPurchaseOrders;
        globalServerDatabase.lastUpdated = new Date().toISOString();

        return {
          success: true,
          data: sanitizedSnapshot,
          lastUpdated: globalServerDatabase.lastUpdated,
          source: "cloudsql",
        };
      } catch (sqlErr) {
        console.warn("Could not sync directly to Cloud SQL, falling back to memory store:", sqlErr);
      }
    }

    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      globalServerDatabase.products = data.products;
    }
    if (data.categories && Array.isArray(data.categories)) {
      globalServerDatabase.categories = data.categories;
    }
    if (data.subCategories && Array.isArray(data.subCategories) && data.subCategories.length > 0) {
      const merged = new Map(
        (globalServerDatabase.subCategories || []).map((item) => [item.id, item]),
      );
      data.subCategories.forEach((item) => merged.set(item.id, item));
      globalServerDatabase.subCategories = [...merged.values()];
    }
    if (data.deletedSubCategoryIds && data.deletedSubCategoryIds.length > 0) {
      const deletedIds = new Set(data.deletedSubCategoryIds);
      globalServerDatabase.subCategories = (globalServerDatabase.subCategories || []).filter(
        (item) => !deletedIds.has(item.id),
      );
    }
    if (data.zones && Array.isArray(data.zones)) {
      globalServerDatabase.zones = data.zones;
    }
    if (data.units && Array.isArray(data.units)) {
      globalServerDatabase.units = data.units;
    }
    if (data.receives && Array.isArray(data.receives)) {
      globalServerDatabase.receives = data.receives;
    }
    if (data.followers && Array.isArray(data.followers)) {
      removeLegacySampleLineFollowers(data.followers).forEach((f) => {
        const existingIdx = globalServerDatabase.followers.findIndex(
          (ef) => ef.userId === f.userId,
        );
        if (existingIdx >= 0) {
          globalServerDatabase.followers[existingIdx] = {
            ...globalServerDatabase.followers[existingIdx],
            ...f,
          };
        } else {
          globalServerDatabase.followers.push(f);
        }
      });
    }
    if (data.movements && Array.isArray(data.movements)) {
      globalServerDatabase.movements = data.movements;
    }
    if (data.purchaseOrders && Array.isArray(data.purchaseOrders)) {
      globalServerDatabase.purchaseOrders = data.purchaseOrders;
    }

    globalServerDatabase.lastUpdated = new Date().toISOString();

    return {
      success: true,
      data: globalServerDatabase,
      lastUpdated: globalServerDatabase.lastUpdated,
      source: "memory",
    };
  });

export const fetchCloudSqlSnapshotFn = createServerFn({ method: "GET" }).handler(async () => {
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
});

export const getLineFollowersHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  globalServerDatabase.followers = removeLegacySampleLineFollowers(globalServerDatabase.followers);
  return {
    success: true,
    followers: globalServerDatabase.followers,
    count: globalServerDatabase.followers.length,
  };
});
