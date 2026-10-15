import { createServerFn } from "@tanstack/react-start";
import {
  createMiniAppPortalFlexBubble,
  DEFAULT_STORE_NAME,
  getSystemStoreName,
} from "./flex-templates";
import { getDatabaseSnapshot, syncDatabasePayload } from "../db/db-service.ts";
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

// In-Memory Global Server Store (Single Source of Truth across all active clients)
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

/**
 * Sync Master Database with Central Server (ข้อมูลต้องตรงกันทุกคน)
 * If client provides updates, server integrates them. Server returns latest state.
 */
export const syncMasterDatabaseFn = createServerFn({ method: "POST" })
  .validator((payload: ServerSyncPayload) => payload)
  .handler(async ({ data }) => {
    // 1. If Cloud SQL credentials are set, sync with PostgreSQL
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
      // Merge unique followers by userId
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
 * Get Server Follower History & User IDs
 */
export const getLineFollowersHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  globalServerDatabase.followers = removeLegacySampleLineFollowers(globalServerDatabase.followers);
  return {
    success: true,
    followers: globalServerDatabase.followers,
    count: globalServerDatabase.followers.length,
  };
});

/** Sync verified LINE Official Account followers and their public profiles. */
export const syncLineFollowersFn = createServerFn({ method: "POST" }).handler(async () => {
  const accessToken = getLineChannelAccessToken();
  if (!accessToken) {
    return {
      success: false as const,
      message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ฝั่งเซิร์ฟเวอร์",
    };
  }

  const userIds: string[] = [];
  let cursor: string | undefined;
  const maxPages = 20;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL("https://api.line.me/v2/bot/followers/ids");
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("start", cursor);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        if (response.status === 403) {
          return {
            success: false as const,
            message:
              "LINE ปฏิเสธการอ่านรายชื่อ: ตรวจ Channel Access Token และสถานะ Official Account (ต้องเป็นบัญชี Verified หรือ Premium)",
          };
        }
        if (response.status === 401) {
          return {
            success: false as const,
            message:
              "LINE Channel Access Token ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบค่า server secret",
          };
        }
        return {
          success: false as const,
          message: `เรียก LINE API ไม่สำเร็จ (HTTP ${response.status})`,
        };
      }

      const pageData = (await response.json()) as { userIds?: unknown; next?: unknown };
      const pageUserIds = Array.isArray(pageData.userIds)
        ? pageData.userIds.filter((userId): userId is string => typeof userId === "string")
        : [];
      userIds.push(...pageUserIds);

      cursor = typeof pageData.next === "string" ? pageData.next : undefined;
      if (!cursor) break;
      if (page === maxPages - 1) {
        return {
          success: false as const,
          message:
            "พบผู้ติดตามมากกว่า 20,000 รายการ จึงหยุดซิงค์เพื่อป้องกันการดึงข้อมูลเกินจำเป็น",
        };
      }
    }

    const uniqueUserIds = [...new Set(userIds)];
    const syncedAt = new Date().toLocaleString("th-TH");
    const profiles: ServerLineFollower[] = new Array(uniqueUserIds.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(8, uniqueUserIds.length) }, async () => {
      while (nextIndex < uniqueUserIds.length) {
        const index = nextIndex;
        nextIndex += 1;
        const userId = uniqueUserIds[index];
        if (!userId) continue;
        const existing = globalServerDatabase.followers.find(
          (follower) => follower.userId === userId,
        );

        try {
          const profileResponse = await fetch(
            `https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          const profile = profileResponse.ok
            ? ((await profileResponse.json()) as {
                displayName?: string;
                pictureUrl?: string;
                statusMessage?: string;
              })
            : undefined;

          profiles[index] = {
            userId,
            displayName: profile?.displayName?.trim() || userId,
            pictureUrl: profile?.pictureUrl,
            statusMessage: profile?.statusMessage,
            followedAt: existing?.followedAt || "ไม่ระบุวันที่จาก LINE",
            lastInteractionAt: syncedAt,
            role:
              existing?.role === "admin" ||
              existing?.role === "staff" ||
              existing?.role === "viewer"
                ? existing.role
                : "viewer",
          };
        } catch {
          profiles[index] = {
            userId,
            displayName: userId,
            followedAt: existing?.followedAt || "ไม่ระบุวันที่จาก LINE",
            lastInteractionAt: syncedAt,
            role:
              existing?.role === "admin" ||
              existing?.role === "staff" ||
              existing?.role === "viewer"
                ? existing.role
                : "viewer",
          };
        }
      }
    });

    await Promise.all(workers);
    const currentFollowers = removeLegacySampleLineFollowers(globalServerDatabase.followers);
    const mergedFollowers = new Map(
      currentFollowers.map((follower) => [follower.userId, follower]),
    );
    profiles.forEach((profile) => mergedFollowers.set(profile.userId, profile));
    globalServerDatabase.followers = [...mergedFollowers.values()];

    return { success: true as const, followers: profiles, count: profiles.length };
  } catch (error) {
    console.error("LINE follower sync failed", error);
    return {
      success: false as const,
      message: "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
});

/**
 * Register / Update a Follower or User
 */
export const registerLineFollowerFn = createServerFn({ method: "POST" })
  .validator((user: ServerLineFollower) => user)
  .handler(async ({ data }) => {
    const existingIdx = globalServerDatabase.followers.findIndex((f) => f.userId === data.userId);
    if (existingIdx >= 0) {
      globalServerDatabase.followers[existingIdx] = {
        ...globalServerDatabase.followers[existingIdx],
        ...data,
        lastInteractionAt:
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      };
    } else {
      globalServerDatabase.followers.unshift({
        ...data,
        followedAt:
          data.followedAt ||
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
        lastInteractionAt:
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      });
    }

    return {
      success: true,
      follower: data,
      allFollowers: globalServerDatabase.followers,
    };
  });

export interface LineApiRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
}

export interface LineApiCallResult {
  ok: boolean;
  status: number;
  bodyText: string;
  attempts: number;
}

/**
 * Wrapper function for LINE Messaging API with Exponential Backoff Auto-Retry
 * Handles HTTP 429 (Rate Limit), 5xx server errors, and network timeouts
 */
export async function callLineMessagingApiWithRetry(
  endpoint: string,
  token: string,
  body: unknown,
  options: LineApiRetryOptions = {},
): Promise<LineApiCallResult> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 10000;

  let lastStatus = 0;
  let lastBodyText = "";
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);
      lastStatus = response.status;
      lastBodyText = await response.text();

      // HTTP 2xx: Success
      if (response.ok) {
        return { ok: true, status: response.status, bodyText: lastBodyText, attempts: attempt };
      }

      // Check if retryable: 429 Too Many Requests or 5xx Server Error
      const isRetryable =
        response.status === 429 || (response.status >= 500 && response.status <= 504);

      if (!isRetryable || attempt >= maxRetries) {
        return { ok: false, status: response.status, bodyText: lastBodyText, attempts: attempt };
      }

      // Exponential backoff with jitter and Retry-After support
      let delayMs = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      const retryAfterHeader = response.headers.get("retry-after");
      if (retryAfterHeader) {
        const parsedSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsedSec) && parsedSec > 0) {
          delayMs = Math.min(parsedSec * 1000, 15000);
        }
      }

      console.warn(
        `[LINE Messaging API] Request failed with HTTP ${response.status} (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delayMs)}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      lastErrorMessage = err instanceof Error ? err.message : String(err);

      console.warn(
        `[LINE Messaging API Network/Timeout] Error on attempt ${attempt}/${maxRetries}: ${lastErrorMessage}`,
      );

      if (attempt >= maxRetries) {
        return {
          ok: false,
          status: 0,
          bodyText: `Network/Timeout error: ${lastErrorMessage}`,
          attempts: attempt,
        };
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    ok: false,
    status: lastStatus,
    bodyText: lastBodyText || lastErrorMessage || "Unknown error",
    attempts: maxRetries,
  };
}

export const sendLineMessagingApiFn = createServerFn({ method: "POST" })
  .validator((data: SendLineOrderPayload) => data)
  .handler(async ({ data }) => {
    const token = (
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
      process.env["LINE_ACCESS_TOKEN"] ||
      process.env["LINE_TOKEN"] ||
      process.env["CHANNEL_ACCESS_TOKEN"] ||
      process.env["ACCESS_TOKEN"] ||
      process.env["LINE_BOT_TOKEN"] ||
      process.env["LINE_MESSAGING_TOKEN"] ||
      data.channelAccessToken
    )?.trim();

    if (!token) {
      return {
        success: false,
        configured: false,
        error:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน GitHub Secrets หรือ Server Environment กรุณาตรวจสอบการตั้งค่าคีย์ใน GitHub Secrets",
      };
    }

    const isBroadcast = Boolean(data.isBroadcast);
    const configuredTargets = (
      process.env["LINE_TO_ID"] ||
      process.env["LINE_TARGET_ID"] ||
      process.env["LINE_USER_ID"] ||
      process.env["LINE_RECEIVER_ID"] ||
      ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedTarget = data.toUserIdOrGroupId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;
    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        error:
          "ยังไม่ได้ระบุผู้รับปลายทาง (LINE_TO_ID ใน GitHub Secrets หรือเลือกผู้รับจากรายชื่อ)",
      };
    }

    // Prepare message payload
    let rawFlex = data.flexMessage;
    if (typeof rawFlex === "string") {
      try {
        rawFlex = JSON.parse(rawFlex);
      } catch {
        // ignore
      }
    }

    let messageObj: unknown;
    if (rawFlex && typeof rawFlex === "object") {
      const flexData = rawFlex as Record<string, unknown>;
      const altSummary = (data.orderSummary || "LINE Flex Message").trim() || "LINE Flex Message";
      if (flexData["type"] === "flex") {
        const altText =
          typeof flexData["altText"] === "string" && flexData["altText"].trim()
            ? flexData["altText"]
            : altSummary;
        messageObj = {
          ...flexData,
          altText,
        };
      } else if (flexData["type"] === "bubble" || flexData["type"] === "carousel") {
        messageObj = {
          type: "flex",
          altText: altSummary,
          contents: flexData,
        };
      } else if (flexData["contents"]) {
        const altText =
          typeof flexData["altText"] === "string" && flexData["altText"].trim()
            ? flexData["altText"]
            : altSummary;
        messageObj = {
          type: "flex",
          altText,
          contents: flexData["contents"],
        };
      } else {
        messageObj = {
          type: "text",
          text: data.orderSummary,
        };
      }
    } else {
      messageObj = {
        type: "text",
        text: data.orderSummary,
      };
    }

    // Prepare Image Message if requested
    const sendFormat = data.format || "FLEX";
    let imageMessageObj: Record<string, unknown> | null = null;

    if (sendFormat === "IMAGE_PNG" || sendFormat === "BOTH") {
      let finalImageUrl = data.imageUrl?.trim() || "";

      if (!finalImageUrl && data.imageBase64?.trim()) {
        try {
          const { storeLineImageFromBase64 } = await import("./line-image-storage");
          const imageId = storeLineImageFromBase64(data.imageBase64);
          const baseOrigin =
            process.env["APP_URL"] ||
            process.env["VERCEL_URL"] ||
            process.env["RENDER_EXTERNAL_URL"] ||
            "https://ais-dev-jc3utk43pgkkismwy5v6xn-837009735838.asia-east1.run.app";
          const cleanOrigin = baseOrigin.startsWith("http") ? baseOrigin : `https://${baseOrigin}`;
          finalImageUrl = `${cleanOrigin}/api/line-image/${imageId}.png`;
        } catch (imgErr) {
          console.warn("Could not cache base64 image on server:", imgErr);
        }
      }

      if (finalImageUrl) {
        imageMessageObj = {
          type: "image",
          originalContentUrl: finalImageUrl,
          previewImageUrl: finalImageUrl,
        };
      }
    }

    // Assemble final messages array for LINE API
    let messagesToSend: unknown[] = [];
    if (sendFormat === "IMAGE_PNG") {
      if (imageMessageObj) {
        messagesToSend = [imageMessageObj];
      } else {
        // Fallback to text if image URL generation failed
        messagesToSend = [messageObj];
      }
    } else if (sendFormat === "BOTH") {
      if (imageMessageObj) {
        messagesToSend = [messageObj, imageMessageObj];
      } else {
        messagesToSend = [messageObj];
      }
    } else {
      messagesToSend = [messageObj];
    }

    try {
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";
      const recipients = isBroadcast ? [undefined] : targets;

      for (const recipient of recipients) {
        const requestBody = isBroadcast
          ? { messages: messagesToSend }
          : { to: recipient, messages: messagesToSend };

        const result = await callLineMessagingApiWithRetry(endpoint, token, requestBody);

        if (!result.ok) {
          return {
            success: false,
            configured: true,
            error: `LINE API ส่งไม่สำเร็จ (Status: ${result.status}, พยายาม ${result.attempts} ครั้ง): ${result.bodyText}`,
          };
        }
      }

      return { success: true, configured: true };
    } catch (err: unknown) {
      return { success: false, configured: true, error: String(err) };
    }
  });

export interface SendMiniAppPortalPayload {
  toUserId?: string | undefined;
  storeName?: string | undefined;
  liffId?: string | undefined;
  isBroadcast?: boolean | undefined;
}

/**
 * Server Function: Send Mini App Entrance Portal Card via LINE Messaging API
 * Allows LINE Messaging API (LINE OA Chat) to be the direct 1-tap gateway into MiniMark LINE Mini App
 */
export const sendMiniAppPortalCardFn = createServerFn({ method: "POST" })
  .validator((data: SendMiniAppPortalPayload) => data)
  .handler(async ({ data }) => {
    const token = (
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
      process.env["LINE_ACCESS_TOKEN"] ||
      process.env["LINE_TOKEN"] ||
      process.env["CHANNEL_ACCESS_TOKEN"] ||
      process.env["ACCESS_TOKEN"] ||
      process.env["LINE_BOT_TOKEN"] ||
      process.env["LINE_MESSAGING_TOKEN"]
    )?.trim();

    const envLiff = (
      process.env["LINE_LIFF_ID"] ||
      process.env["VITE_LINE_LIFF_ID"] ||
      process.env["LIFF_ID"] ||
      process.env["LINE_LIFF"] ||
      process.env["LIFFID"] ||
      data.liffId ||
      ""
    ).trim();

    const liffId = envLiff && envLiff !== "xxxxx-xxxxx" ? envLiff : "2007000000-xxxxxx";
    const storeName = getSystemStoreName(data.storeName);

    const portalBubble = createMiniAppPortalFlexBubble({
      storeName,
      liffId,
    });

    const portalMessage = {
      type: "flex",
      altText: `🏪 ทางเข้าใช้งาน LINE Mini App — ${storeName}`,
      contents: portalBubble,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "uri",
              label: "🛒 สั่งซื้อสินค้า",
              uri: `https://liff.line.me/${liffId}/reorder`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📦 สต็อกสินค้า",
              uri: `https://liff.line.me/${liffId}/stock`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📷 สแกนบาร์โค้ด",
              uri: `https://liff.line.me/${liffId}/scan`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📊 แดชบอร์ด",
              uri: `https://liff.line.me/${liffId}`,
            },
          },
        ],
      },
    };

    if (!token) {
      return {
        success: false,
        configured: false,
        flexPayload: portalMessage,
        error:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน GitHub Secrets หรือ Server Environment",
      };
    }

    const isBroadcast = Boolean(data.isBroadcast);
    const configuredTargets = (
      process.env["LINE_TO_ID"] ||
      process.env["LINE_TARGET_ID"] ||
      process.env["LINE_USER_ID"] ||
      process.env["LINE_RECEIVER_ID"] ||
      ""
    )
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const requestedTarget = data.toUserId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;

    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: "ยังไม่ได้ระบุผู้รับปลายทาง (ระบุ LINE User ID หรือตั้งค่า LINE_TO_ID ใน Secrets)",
      };
    }

    try {
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";
      const recipients = isBroadcast ? [undefined] : targets;

      for (const recipient of recipients) {
        const requestBody = isBroadcast
          ? { messages: [portalMessage] }
          : { to: recipient, messages: [portalMessage] };

        const result = await callLineMessagingApiWithRetry(endpoint, token, requestBody);

        if (!result.ok) {
          return {
            success: false,
            configured: true,
            flexPayload: portalMessage,
            error: `LINE Messaging API ส่งไม่สำเร็จ: ${result.bodyText}`,
          };
        }
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
