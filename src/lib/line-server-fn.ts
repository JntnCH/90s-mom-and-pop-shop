import { createServerFn } from "@tanstack/react-start";
import {
  createMiniAppPortalFlexBubble,
  DEFAULT_STORE_NAME,
  getSystemStoreName,
} from "./flex-templates";
import { getDatabaseSnapshot, syncDatabasePayload } from "../db/db-service.ts";
import { getD1Snapshot, isD1Available, syncD1Payload, type D1SyncPayload } from "../db/d1-snapshot.ts";
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
  replaceZones?: boolean | undefined;
  deletedZoneIds?: string[] | undefined;
  units?: UnitItem[] | undefined;
  receives?: ReceiveItem[] | undefined;
  followers?: LineUserFollower[] | undefined;
  movements?: StockMovementLog[] | undefined;
  purchaseOrders?: PurchaseOrderRecord[] | undefined;
  deletedPurchaseOrderIds?: string[] | undefined;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type DatabaseSnapshot = Awaited<ReturnType<typeof getDatabaseSnapshot>>;
type DatabaseFollower = DatabaseSnapshot["followers"][number];
type SnapshotPurchaseOrder = Omit<DatabaseSnapshot["purchaseOrders"][number], "items"> & {
  items: JsonValue[];
};

/** Safe process.env read — never throws in browser / Workers client */
function envGet(key: string): string {
  try {
    if (typeof process !== "undefined" && process?.env && typeof process.env[key] === "string") {
      return process.env[key] as string;
    }
  } catch {
    // client bundle has no process
  }
  return "";
}

function isPostgresConfigured(): boolean {
  const hasHost = Boolean(envGet("SQL_HOST") || envGet("INSTANCE_CONNECTION_NAME"));
  const hasUser = Boolean(
    envGet("SQL_USER") || envGet("SQL_ADMIN_USER") || envGet("DB_USER") || envGet("PGUSER"),
  );
  const hasPass = Boolean(
    envGet("SQL_PASSWORD") ||
      envGet("SQL_ADMIN_PASSWORD") ||
      envGet("DB_PASSWORD") ||
      envGet("PGPASSWORD"),
  );
  return hasHost && hasUser && hasPass;
}

// In-Memory Global Server Store (no disk I/O at module load — safe for client bundles)
const globalServerDatabase: {
  lastUpdated: string;
  products: ProductItem[];
  categories: CategoryItem[];
  subCategories: SubCategoryItem[];
  zones: ZoneItem[];
  units: UnitItem[];
  receives: ReceiveItem[];
  followers: (ServerLineFollower | DatabaseFollower)[];
  movements: StockMovementLog[];
  purchaseOrders: (PurchaseOrderRecord | SnapshotPurchaseOrder)[];
} = {
  lastUpdated: new Date().toISOString(),
  products: [],
  categories: [],
  subCategories: [],
  zones: [],
  units: [],
  receives: [],
  followers: [],
  movements: [],
  purchaseOrders: [],
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
    envGet("LINE_CHANNEL_ACCESS_TOKEN") ||
    envGet("LINE_ACCESS_TOKEN") ||
    envGet("LINE_TOKEN") ||
    envGet("CHANNEL_ACCESS_TOKEN") ||
    envGet("ACCESS_TOKEN") ||
    envGet("LINE_BOT_TOKEN") ||
    envGet("LINE_MESSAGING_TOKEN") ||
    ""
  ).trim();
}

export const getLineServerConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const envLiff = (
    envGet("LINE_LIFF_ID") ||
    envGet("VITE_LINE_LIFF_ID") ||
    envGet("LIFF_ID") ||
    envGet("LINE_LIFF") ||
    envGet("LIFFID") ||
    envGet("VITE_LIFF_ID") ||
    ""
  ).trim();
  const validLiff = envLiff && envLiff !== "xxxxx-xxxxx" ? envLiff : DEFAULT_LINE_LIFF_ID;
  const hasAccessToken = Boolean(getLineChannelAccessToken());
  return {
    hasChannelId: Boolean(envGet("LINE_CHANNEL_ID") || envGet("CHANNEL_ID")),
    hasChannelSecret: Boolean(
      envGet("LINE_CHANNEL_SECRET") || envGet("CHANNEL_SECRET") || envGet("LINE_SECRET"),
    ),
    hasAccessToken,
    hasServerLiffId: Boolean(validLiff),
    configuredLiffId: validLiff,
    hasLineToId: Boolean(
      envGet("LINE_TO_ID") ||
        envGet("LINE_TARGET_ID") ||
        envGet("LINE_USER_ID") ||
        envGet("LINE_RECEIVER_ID"),
    ),
  };
});

export const syncMasterDatabaseFn = createServerFn({ method: "POST" })
  .validator((payload: ServerSyncPayload) => payload)
  .handler(async ({ data }) => {
    let d1Result: Awaited<ReturnType<typeof syncD1Payload>> = null;
    let d1Success = false;
    try {
      const d1Available = await isD1Available();
      if (d1Available) {
        d1Result = await syncD1Payload({
          products: data.products,
          categories: data.categories,
          subCategories: data.subCategories,
          deletedSubCategoryIds: data.deletedSubCategoryIds,
          zones: data.zones,
          deletedZoneIds: data.deletedZoneIds,
          units: data.units,
          purchaseOrders: data.purchaseOrders as unknown as D1SyncPayload["purchaseOrders"],
          deletedPurchaseOrderIds: data.deletedPurchaseOrderIds,
          movements: data.movements as unknown as D1SyncPayload["movements"],
          receives: data.receives as unknown as D1SyncPayload["receives"],
          followers: removeLegacySampleLineFollowers(data.followers),
        });
        if (d1Result) {
          d1Success = true;
          const clientProducts = data.products;
          const useClientProducts =
            Array.isArray(clientProducts) &&
            clientProducts.length > 0 &&
            clientProducts.length >= (d1Result.products?.length || 0);
          globalServerDatabase.products = useClientProducts ? clientProducts! : d1Result.products;
          globalServerDatabase.categories =
            data.categories && data.categories.length > 0 ? data.categories : d1Result.categories;
          globalServerDatabase.units =
            data.units && data.units.length > 0 ? data.units : d1Result.units;
          globalServerDatabase.zones =
            data.zones && data.zones.length > 0 ? data.zones : d1Result.zones;
          globalServerDatabase.subCategories =
            data.subCategories && data.subCategories.length > 0
              ? data.subCategories
              : d1Result.subCategories;
          if (d1Result.purchaseOrders?.length)
            globalServerDatabase.purchaseOrders = d1Result.purchaseOrders as unknown as (
              | PurchaseOrderRecord
              | SnapshotPurchaseOrder
            )[];
          if (d1Result.movements?.length)
            globalServerDatabase.movements = d1Result.movements as unknown as StockMovementLog[];
          if (d1Result.receives?.length)
            globalServerDatabase.receives = d1Result.receives as unknown as ReceiveItem[];
          if (d1Result.followers?.length)
            globalServerDatabase.followers = d1Result.followers as unknown as (
              | ServerLineFollower
              | DatabaseFollower
            )[];
          globalServerDatabase.lastUpdated = new Date().toISOString();
        }
      }
    } catch (d1Err) {
      console.warn("[Database Sync] D1 sync notice:", d1Err);
    }

    if (d1Success && d1Result) {
      return {
        success: true,
        data: {
          products: globalServerDatabase.products,
          categories: globalServerDatabase.categories,
          units: globalServerDatabase.units,
          zones: globalServerDatabase.zones,
          subCategories: globalServerDatabase.subCategories,
          purchaseOrders: globalServerDatabase.purchaseOrders || [],
          movements: globalServerDatabase.movements || [],
          receives: globalServerDatabase.receives || [],
          followers: globalServerDatabase.followers || [],
        },
        lastUpdated: globalServerDatabase.lastUpdated,
        source: "d1",
      };
    }

    if (data.products?.length) {
      const productMap = new Map((globalServerDatabase.products || []).map((p) => [p.id, p]));
      data.products.forEach((p) => {
        const existing = productMap.get(p.id);
        productMap.set(p.id, existing ? { ...existing, ...p } : p);
      });
      globalServerDatabase.products = Array.from(productMap.values());
    }
    if (data.categories?.length) globalServerDatabase.categories = data.categories;
    if (data.units?.length) globalServerDatabase.units = data.units;
    if (data.zones?.length) globalServerDatabase.zones = data.zones;
    if (data.subCategories?.length) globalServerDatabase.subCategories = data.subCategories;
    if (data.purchaseOrders?.length)
      globalServerDatabase.purchaseOrders = data.purchaseOrders as unknown as (
        | PurchaseOrderRecord
        | SnapshotPurchaseOrder
      )[];
    if (data.followers?.length)
      globalServerDatabase.followers = removeLegacySampleLineFollowers(data.followers) as (
        | ServerLineFollower
        | DatabaseFollower
      )[];
    globalServerDatabase.lastUpdated = new Date().toISOString();

    return {
      success: true,
      data: {
        products: globalServerDatabase.products,
        categories: globalServerDatabase.categories,
        units: globalServerDatabase.units,
        zones: globalServerDatabase.zones,
        subCategories: globalServerDatabase.subCategories,
        purchaseOrders: globalServerDatabase.purchaseOrders || [],
        movements: globalServerDatabase.movements || [],
        receives: globalServerDatabase.receives || [],
        followers: globalServerDatabase.followers || [],
      },
      lastUpdated: globalServerDatabase.lastUpdated,
      source: "memory",
    };
  });

export const fetchCloudSqlSnapshotFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const d1 = await getD1Snapshot();
    if (d1) {
      return { success: true, source: "d1", data: d1 };
    }
  } catch (e) {
    console.warn("[fetchCloudSqlSnapshotFn] D1:", e);
  }
  return {
    success: true,
    source: "memory",
    data: {
      products: globalServerDatabase.products,
      categories: globalServerDatabase.categories,
      units: globalServerDatabase.units,
      zones: globalServerDatabase.zones,
      subCategories: globalServerDatabase.subCategories,
      purchaseOrders: globalServerDatabase.purchaseOrders,
      movements: globalServerDatabase.movements,
      receives: globalServerDatabase.receives,
      followers: globalServerDatabase.followers,
    },
  };
});

export const getDatabaseInspectionFn = createServerFn({ method: "GET" }).handler(async () => {
  let d1Available = false;
  let d1ProductCount = 0;
  try {
    d1Available = await isD1Available();
    if (d1Available) {
      const snap = await getD1Snapshot();
      d1ProductCount = snap?.products?.length ?? 0;
    }
  } catch {
    // ignore
  }
  return {
    success: true,
    postgresConfigured: isPostgresConfigured(),
    d1Available,
    d1ProductCount,
    memory: {
      lastUpdated: globalServerDatabase.lastUpdated,
      products: globalServerDatabase.products.length,
      categories: globalServerDatabase.categories.length,
      units: globalServerDatabase.units.length,
      zones: globalServerDatabase.zones.length,
      purchaseOrders: globalServerDatabase.purchaseOrders.length,
      followers: globalServerDatabase.followers.length,
    },
  };
});

export const getLineFollowersHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  return { success: true, followers: globalServerDatabase.followers || [] };
});

export const syncLineFollowersFn = createServerFn({ method: "POST" }).handler(async () => {
  return { success: true, followers: globalServerDatabase.followers || [] };
});

export const registerLineFollowerFn = createServerFn({ method: "POST" })
  .validator((data: ServerLineFollower) => data)
  .handler(async ({ data }) => {
    const list = globalServerDatabase.followers || [];
    const idx = list.findIndex((f) => f.userId === data.userId);
    if (idx >= 0) list[idx] = { ...list[idx], ...data };
    else list.push(data);
    globalServerDatabase.followers = list;
    globalServerDatabase.lastUpdated = new Date().toISOString();
    return { success: true, follower: data };
  });

export const sendLineMessagingApiFn = createServerFn({ method: "POST" })
  .validator((data: SendLineOrderPayload) => data)
  .handler(async ({ data }) => {
    const token = (data.channelAccessToken || getLineChannelAccessToken()).trim();
    if (!token) {
      return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN not configured" };
    }
    const to =
      data.toUserIdOrGroupId ||
      envGet("LINE_TO_ID") ||
      envGet("LINE_TARGET_ID") ||
      envGet("LINE_USER_ID") ||
      envGet("LINE_RECEIVER_ID");
    if (!to && !data.isBroadcast) {
      return { success: false, error: "No LINE target user/group id" };
    }
    const messages: unknown[] = [];
    if (data.flexMessage) {
      messages.push({
        type: "flex",
        altText: data.orderSummary?.slice(0, 400) || "Order",
        contents: data.flexMessage,
      });
    }
    if (data.imageUrl) {
      messages.push({
        type: "image",
        originalContentUrl: data.imageUrl,
        previewImageUrl: data.imageUrl,
      });
    }
    if (messages.length === 0 && data.orderSummary) {
      messages.push({ type: "text", text: data.orderSummary.slice(0, 5000) });
    }
    if (messages.length === 0) {
      return { success: false, error: "No message content" };
    }
    const url = data.isBroadcast
      ? "https://api.line.me/v2/bot/message/broadcast"
      : "https://api.line.me/v2/bot/message/push";
    const body = data.isBroadcast ? { messages } : { to, messages };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `LINE API ${res.status}: ${errText}` };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

export const sendMiniAppPortalCardFn = createServerFn({ method: "POST" })
  .validator((data: { toUserIdOrGroupId?: string }) => data)
  .handler(async ({ data }) => {
    const token = getLineChannelAccessToken();
    const liffId =
      envGet("LINE_LIFF_ID") ||
      envGet("VITE_LINE_LIFF_ID") ||
      envGet("LIFF_ID") ||
      DEFAULT_LINE_LIFF_ID;
    const storeName = getSystemStoreName?.() || DEFAULT_STORE_NAME;
    const portalMessage = createMiniAppPortalFlexBubble({
      storeName,
      liffId,
    });
    const to =
      data.toUserIdOrGroupId ||
      envGet("LINE_TO_ID") ||
      envGet("LINE_TARGET_ID") ||
      envGet("LINE_USER_ID") ||
      envGet("LINE_RECEIVER_ID");
    if (!token) {
      return {
        success: false,
        configured: false,
        flexPayload: portalMessage,
        error: "No LINE token",
      };
    }
    if (!to) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: "No LINE target",
      };
    }
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to,
          messages: [
            {
              type: "flex",
              altText: `${storeName} Mini App`,
              contents: portalMessage,
            },
          ],
        }),
      });
      if (!res.ok) {
        return {
          success: false,
          configured: true,
          flexPayload: portalMessage,
          error: await res.text(),
        };
      }
      return { success: true, configured: true, flexPayload: portalMessage };
    } catch (err: unknown) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: String(err),
      };
    }
  });
