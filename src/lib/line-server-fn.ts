import { createServerFn } from "@tanstack/react-start";
import { getDatabaseSnapshot, syncDatabasePayload } from "../db/db-service.ts";
import { removeLegacySampleLineFollowers } from "./line-follower-data";
import {
  globalServerDatabase,
  isJsonValue,
  getLineChannelAccessToken,
  DEFAULT_LINE_LIFF_ID,
  type ServerSyncPayload,
  type SnapshotPurchaseOrder,
  type JsonValue,
} from "./line-server-shared";

export type {
  LineMessageSendFormat,
  SendLineOrderPayload,
  ServerLineFollower,
  ServerSyncPayload,
} from "./line-server-shared";
export { DEFAULT_LINE_LIFF_ID, globalServerDatabase, getLineChannelAccessToken } from "./line-server-shared";

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

/**
 * Sync Master Database with Central Server (ข้อมูลต้องตรงกันทุกคน)
 * If client provides updates, server integrates them. Server returns latest state.
 */
export const syncMasterDatabaseFn = createServerFn({ method: "POST" })
  .validator((payload: ServerSyncPayload) => payload)
  .handler(async ({ data }) => {
    // 1. Sync with Cloudflare D1 (primary store)
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
          source: "d1",
        };
    } catch (sqlErr) {
      console.warn("Could not sync to Cloudflare D1, falling back to memory store:", sqlErr);
    }

    // 2. In-memory fallback
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

/**
 * Fetch complete database snapshot from Cloudflare D1 (with memory fallback)
 */
export const fetchCloudSqlSnapshotFn = createServerFn({ method: "GET" }).handler(async () => {
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
});

// Re-export LINE ops so existing imports from "./line-server-fn" keep working
export {
  getLineFollowersHistoryFn,
  syncLineFollowersFn,
  registerLineFollowerFn,
  sendLineMessagingApiFn,
  sendMiniAppPortalCardFn,
} from "./line-server-fn-ops";
