/**
 * LINE Integration Service
 * Handles LINE LIFF, Mini App detection, and LINE Flex Message for Purchase Orders.
 * Strictly adheres to Zero-Secret-Leakage: All keys come from Environment Injection.
 */

import type { Liff } from "@line/liff";
import { MasterStore, type ProductItem } from "./store";
import {
  createDailySummaryFlexBubble,
  createPurchaseOrderFlexBubble,
  createStockAlertFlexBubble,
  DEFAULT_STORE_NAME,
  type FlexItemGroupBy,
  type FlexOrderItem,
  type FlexStockAlertItem,
  getSystemStoreName,
  groupAndSortFlexItems,
  type PurchaseOrderFlexOptions,
  type StockAlertFlexOptions,
} from "./flex-templates";
import {
  getLatestPurchaseOrderFlexMessage,
  populatePurchaseOrderFlexTemplate,
} from "./flex-templates/flex-simulator-json";
import { getLineServerConfigFn, sendLineMessagingApiFn } from "./line-server-fn";

export interface LineOrderItem {
  product: ProductItem;
  quantity: number;
  unitName: string;
}

type LiffMessage = Parameters<Liff["shareTargetPicker"]>[0][number];
type LiffFlexMessage = Extract<LiffMessage, { type: "flex" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFlexContents(value: unknown): value is LiffFlexMessage["contents"] {
  if (!isRecord(value)) return false;
  if (value["type"] === "bubble") return true;
  return (
    value["type"] === "carousel" &&
    Array.isArray(value["contents"]) &&
    value["contents"].length > 0 &&
    value["contents"].every((content) => isRecord(content) && content["type"] === "bubble")
  );
}

function toLiffMessage(value: unknown, fallbackText: string): LiffMessage {
  if (isRecord(value)) {
    const contents =
      value["type"] === "flex"
        ? value["contents"]
        : isFlexContents(value)
          ? value
          : value["contents"];
    if (isFlexContents(contents)) {
      const altText =
        typeof value["altText"] === "string" && value["altText"].trim()
          ? value["altText"]
          : fallbackText;
      return { type: "flex", altText, contents };
    }
  }
  return { type: "text", text: fallbackText };
}

export interface LineConfigStatus {
  hasLiffId: boolean;
  liffIdDisplay: string;
  isInClient: boolean;
  isLoggedIn: boolean;
  profileName?: string | undefined;
  profilePicture?: string | undefined;
  error?: string | undefined;
}

export const DEFAULT_LINE_LIFF_ID = "2011710264-gaZ7oEcK";

let memoryLiffId: string | null = DEFAULT_LINE_LIFF_ID;

// Retrieve LIFF ID from memory, URL params, localStorage, Vite env, or runtime config
export function getClientLiffId(): string | null {
  if (memoryLiffId && memoryLiffId.trim() && memoryLiffId.trim() !== "xxxxx-xxxxx") {
    return memoryLiffId.trim();
  }
  if (typeof window !== "undefined") {
    // 1. Check URL parameters (e.g. ?liffId=... or ?liff_id=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramId =
        urlParams.get("liffId") || urlParams.get("liff_id") || urlParams.get("liffID");
      if (paramId && paramId.trim() && paramId.trim() !== "xxxxx-xxxxx") {
        setClientLiffId(paramId.trim());
        return paramId.trim();
      }
    } catch {
      // ignore
    }

    // 2. Check window cached object
    const w = window as unknown as { __MINIMARK_LIFF_ID?: string };
    if (
      w.__MINIMARK_LIFF_ID &&
      w.__MINIMARK_LIFF_ID.trim() &&
      w.__MINIMARK_LIFF_ID.trim() !== "xxxxx-xxxxx"
    ) {
      memoryLiffId = w.__MINIMARK_LIFF_ID.trim();
      return memoryLiffId;
    }

    // 3. Check localStorage
    const local = localStorage.getItem("minimark_line_liff_id");
    if (local && local.trim() && local.trim() !== "xxxxx-xxxxx") {
      memoryLiffId = local.trim();
      return memoryLiffId;
    }
  }
  const id =
    import.meta.env["VITE_LINE_LIFF_ID"] ||
    import.meta.env["LINE_LIFF_ID"] ||
    import.meta.env["VITE_LIFF_ID"] ||
    import.meta.env["LIFF_ID"];
  if (id && typeof id === "string" && id.trim() !== "" && id.trim() !== "xxxxx-xxxxx") {
    memoryLiffId = id.trim();
    return memoryLiffId;
  }
  return DEFAULT_LINE_LIFF_ID;
}

export function setClientLiffId(id: string): void {
  if (!id || !id.trim() || id.trim() === "xxxxx-xxxxx") {
    memoryLiffId = null;
    if (typeof window !== "undefined") {
      const w = window as unknown as { __MINIMARK_LIFF_ID?: string };
      delete w.__MINIMARK_LIFF_ID;
      localStorage.removeItem("minimark_line_liff_id");
    }
  } else {
    memoryLiffId = id.trim();
    if (typeof window !== "undefined") {
      const w = window as unknown as { __MINIMARK_LIFF_ID?: string };
      w.__MINIMARK_LIFF_ID = id.trim();
      localStorage.setItem("minimark_line_liff_id", id.trim());
    }
  }
  liffInstance = null;
}

let liffInstance: typeof import("@line/liff").default | null = null;
let isInitializingLiff = false;

/**
 * Initializes LINE LIFF SDK safely (Browser-only)
 */
export async function initLiff(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (liffInstance) return true;
  if (isInitializingLiff) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (liffInstance) return true;
  }

  let liffId = getClientLiffId();
  if (!liffId) {
    try {
      const cfg = await getLineServerConfigFn();
      if (cfg?.configuredLiffId) {
        setClientLiffId(cfg.configuredLiffId);
        liffId = cfg.configuredLiffId;
      }
    } catch {
      // ignore
    }
  }
  if (!liffId) {
    return false;
  }

  isInitializingLiff = true;
  try {
    const liffMod = await import("@line/liff");
    const liff = liffMod.default;

    if (!liff.id) {
      await liff.init({ liffId, withLoginOnExternalBrowser: false });
    }
    liffInstance = liff;
    return true;
  } catch (err) {
    console.warn("LIFF initialization note:", err);
    liffInstance = null;
    return false;
  } finally {
    isInitializingLiff = false;
  }
}

/**
 * Gets current LIFF and LINE environment diagnostics safely without eager SDK init.
 */
export async function getLineStatus(): Promise<LineConfigStatus> {
  try {
    const liffId = getClientLiffId();
    if (!liffId) {
      return {
        hasLiffId: false,
        liffIdDisplay: "ไม่ได้ตั้งค่า (ดึงจาก GitHub Secrets)",
        isInClient: false,
        isLoggedIn: false,
      };
    }

    if (liffInstance) {
      const inClient =
        typeof liffInstance.isInClient === "function" ? liffInstance.isInClient() : false;
      const loggedIn =
        typeof liffInstance.isLoggedIn === "function" ? liffInstance.isLoggedIn() : false;
      let profileName: string | undefined;
      let profilePicture: string | undefined;

      if (loggedIn && typeof liffInstance.getProfile === "function") {
        try {
          const profile = await liffInstance.getProfile();
          profileName = profile?.displayName;
          profilePicture = profile?.pictureUrl;
        } catch {
          // Profile fetch optional
        }
      }

      return {
        hasLiffId: true,
        liffIdDisplay: `${liffId.slice(0, 4)}...${liffId.slice(-4)}`,
        isInClient: inClient,
        isLoggedIn: loggedIn,
        profileName,
        profilePicture,
      };
    }

    return {
      hasLiffId: true,
      liffIdDisplay: `${liffId.slice(0, 4)}...${liffId.slice(-4)}`,
      isInClient: false,
      isLoggedIn: false,
    };
  } catch (err) {
    return {
      hasLiffId: false,
      liffIdDisplay: "เกิดข้อผิดพลาด",
      isInClient: false,
      isLoggedIn: false,
      error: String(err),
    };
  }
}

/**
 * Generates LINE Flex Message payload for Daily Purchase Order.
 * Specifications: จัดกลุ่มหมวดหมู่/โซน -> รายการ -> จำนวน -> หน่วยนับ
 */
export function buildOrderFlexMessage(
  orders: LineOrderItem[],
  note: string = "ใบสั่งซื้อสินค้าประจำวัน",
  storeName: string = DEFAULT_STORE_NAME,
  options?: Partial<PurchaseOrderFlexOptions>,
) {
  const items: FlexOrderItem[] = orders.map((o) => {
    const catName = o.product.categoryId
      ? MasterStore.getCategoryName(o.product.categoryId)
      : undefined;
    const zName = o.product.zoneId ? MasterStore.getZoneName(o.product.zoneId) : undefined;
    return {
      name: o.product.name,
      quantity: o.quantity,
      unitName: o.unitName,
      costPrice: o.product.costPrice,
      barcode: o.product.barcode,
      categoryId: o.product.categoryId,
      categoryName: catName,
      zoneId: o.product.zoneId,
      zoneName: zName,
    };
  });

  const liffId = getClientLiffId() || undefined;
  const resolvedStoreName = getSystemStoreName(storeName);

  const groupBy = options?.groupBy || "category";
  const includeZone =
    options?.includeZone ??
    (groupBy === "zone" || groupBy === "zone_then_category" || groupBy === "category_then_zone");

  return createPurchaseOrderFlexBubble(items, {
    storeName: resolvedStoreName,
    note,
    liffId,
    groupBy,
    showGroupHeaders: options?.showGroupHeaders,
    includeZone,
    ...options,
  });
}

/**
 * Creates plain text fallback for web share intent, grouped by Category
 */
export function buildOrderPlainText(
  orders: LineOrderItem[],
  storeName: string = DEFAULT_STORE_NAME,
  groupBy: FlexItemGroupBy = "category",
  showGroupHeaders: boolean = true,
): string {
  const resolvedStoreName = getSystemStoreName(storeName);
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH");
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const isNoHeader =
    !showGroupHeaders ||
    groupBy === "none" ||
    groupBy === "category_no_header" ||
    groupBy === "zone_no_header";

  const groupingLabel = isNoHeader
    ? "รายการสินค้า:"
    : groupBy === "zone"
      ? "รายการสินค้า (จัดกลุ่มตามโซนจัดวาง):"
      : groupBy === "zone_then_category"
        ? "รายการสินค้า (จัดกลุ่มตามโซน ➔ หมวดหมู่):"
        : "รายการสินค้า (จัดกลุ่มตามหมวดหมู่):";

  let text = `📦 ใบสั่งซื้อสินค้าประจำวัน — ${resolvedStoreName}\n`;
  text += `📅 วันที่: ${dateStr} เวลา ${timeStr} น.\n`;
  text += `────────────────────\n`;
  text += `${groupingLabel}\n\n`;

  const itemsForGrouping = orders.map((o) => {
    const catName = o.product.categoryId
      ? MasterStore.getCategoryName(o.product.categoryId)
      : undefined;
    const zName = o.product.zoneId ? MasterStore.getZoneName(o.product.zoneId) : undefined;
    return {
      name: o.product.name,
      quantity: o.quantity,
      unitName: o.unitName,
      costPrice: o.product.costPrice,
      barcode: o.product.barcode,
      categoryId: o.product.categoryId,
      categoryName: catName,
      zoneId: o.product.zoneId,
      zoneName: zName,
    };
  });

  const includeZone =
    groupBy === "zone" ||
    groupBy === "zone_no_header" ||
    groupBy === "zone_then_category" ||
    groupBy === "category_then_zone";
  const grouped = groupAndSortFlexItems(itemsForGrouping, { groupBy, includeZone });
  let counter = 0;

  grouped.forEach((grp) => {
    if (!isNoHeader && grp.headerTitle && groupBy !== "none") {
      text += `${grp.headerTitle} (${grp.items.length} รายการ)\n`;
    }
    grp.items.forEach(({ item }) => {
      counter++;
      text += `  ${counter}. ${item.name} ➔ ${item.quantity} ${item.unitName}\n`;
    });
    if (!isNoHeader) {
      text += `\n`;
    }
  });

  const totalItems = orders.reduce((sum, o) => sum + o.quantity, 0);
  const totalCost = orders.reduce((sum, o) => sum + o.quantity * (o.product.costPrice || 0), 0);

  text += `────────────────────\n`;
  text += `รวมสินค้าทั้งหมด: ${totalItems} หน่วย (${orders.length} รายการ)\n`;
  text += `ประมาณการค่าใช้จ่าย: ฿${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n`;
  text += `ส่งจากระบบ ${resolvedStoreName}`;

  return text;
}

export type LineShareTarget = "group" | "personal";

export interface ThreeTierSendOptions {
  summary: string;
  flexMessage?: unknown;
  target?: LineShareTarget | undefined;
  toUserIdOrGroupId?: string | undefined;
  isBroadcast?: boolean | undefined;
  channelAccessToken?: string | undefined;
  disableIntentFallback?: boolean | undefined;
}

export interface LineShareResult {
  success: boolean;
  channel: "server_api" | "liff_picker" | "liff_send" | "line_intent";
  tier: 1 | 2 | 3;
  message: string;
  fallbackReason?: string | undefined;
}

/**
 * Directly trigger LINE LIFF shareTargetPicker with a Flex Message
 */
export async function shareFlexViaLiffPicker(
  flexMessage: unknown | unknown[],
  altSummary: string = `รายการสั่งซื้อสินค้า ${DEFAULT_STORE_NAME}`,
): Promise<{
  success: boolean;
  message: string;
  needLiffId?: boolean;
}> {
  if (typeof window === "undefined") {
    return { success: false, message: "ทำงานบนเบราว์เซอร์เท่านั้น" };
  }

  let liffId = getClientLiffId();
  if (!liffId) {
    try {
      const cfg = await getLineServerConfigFn();
      if (cfg?.configuredLiffId) {
        setClientLiffId(cfg.configuredLiffId);
        liffId = cfg.configuredLiffId;
      }
    } catch {
      // ignore
    }
  }

  if (!liffId) {
    return {
      success: false,
      needLiffId: true,
      message: "ยังไม่ได้ระบุ LINE LIFF ID กรุณาใส่ LIFF ID ของท่านเพื่อเปิดรายชื่อเพื่อน",
    };
  }

  const initialized = await initLiff();
  if (!initialized || !liffInstance) {
    return {
      success: false,
      needLiffId: true,
      message: `ไม่สามารถเริ่มต้น LINE LIFF SDK ได้ (${liffId}) กรุณาตรวจสอบว่ากรอก LIFF ID ถูกต้อง`,
    };
  }

  try {
    const messagePayloads = (Array.isArray(flexMessage) ? flexMessage : [flexMessage]).map(
      (message) => toLiffMessage(message, altSummary),
    );

    // Diagnostic check for API availability in this environment
    const isApiAvailable =
      typeof liffInstance.isApiAvailable === "function"
        ? liffInstance.isApiAvailable("shareTargetPicker")
        : true;

    if (!isApiAvailable) {
      console.warn("[LIFF] shareTargetPicker is reported as not available by LINE SDK");
    }

    if (typeof liffInstance.isLoggedIn === "function" && !liffInstance.isLoggedIn()) {
      return {
        success: false,
        message: "ระบบเปิดในโหมดเว็บภายนอก กรุณาเลือกผู้รับจากรายชื่อในระบบ หรือเปิดผ่านลิงก์ LIFF",
      };
    }

    if (typeof liffInstance.shareTargetPicker === "function") {
      const res = await liffInstance.shareTargetPicker(messagePayloads);
      if (res) {
        return {
          success: true,
          message: "ส่ง LINE Flex Message ไปยังเพื่อน/กลุ่มที่เลือกสำเร็จแล้ว",
        };
      }
      return {
        success: false,
        message: "ยกเลิกการเลือกห้องแชทใน LINE",
      };
    }

    return {
      success: false,
      message: "ไม่พบฟังก์ชัน Share Target Picker ใน LINE LIFF SDK",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[LIFF shareTargetPicker error]", err);
    return {
      success: false,
      message: `LINE Share Target Picker (${errMsg}): กรุณาตรวจสอบว่าเปิด Share Target Picker: ON และปิด-เปิดแอป LINE ใหม่อีกครั้ง`,
    };
  }
}

/**
 * 3-Tier Fallback Dispatcher for LINE Messaging:
 * Tier 1: Server LINE Messaging API (Push/Broadcast via Bot)
 * Tier 2: LINE LIFF shareTargetPicker / in-client send
 * Tier 3: Web Share Intent (https://line.me/R/share)
 */
export async function sendWith3TierFallback(
  options: ThreeTierSendOptions,
): Promise<LineShareResult> {
  const { summary, flexMessage, target = "group", toUserIdOrGroupId, isBroadcast } = options;
  let tier1ErrorReason = "";

  const tokenToUse =
    options.channelAccessToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("minimark_line_channel_token") || undefined
      : undefined);

  // ─────────────────────────────────────────────────────────────
  // Tier 1: Server LINE Messaging API (Sends REAL Flex Message)
  // ─────────────────────────────────────────────────────────────
  try {
    const serverRes = await sendLineMessagingApiFn({
      data: {
        orderSummary: summary,
        ...(flexMessage !== undefined ? { flexMessage } : {}),
        ...(toUserIdOrGroupId !== undefined ? { toUserIdOrGroupId } : {}),
        ...(isBroadcast !== undefined ? { isBroadcast } : {}),
        ...(tokenToUse !== undefined ? { channelAccessToken: tokenToUse } : {}),
      },
    });

    if (serverRes.success) {
      return {
        success: true,
        channel: "server_api",
        tier: 1,
        message: "ส่ง Flex Message ผ่าน Server LINE Messaging API สำเร็จ (Tier 1)",
      };
    } else {
      tier1ErrorReason = serverRes.error || "Server LINE Messaging API ไม่พร้อมใช้งาน";
      console.warn(
        `[3-Tier Fallback] Tier 1 unavailable: ${tier1ErrorReason}. Cascading to Tier 2 (LIFF)...`,
      );
    }
  } catch (err: unknown) {
    tier1ErrorReason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[3-Tier Fallback] Tier 1 error: ${tier1ErrorReason}. Cascading to Tier 2 (LIFF)...`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Tier 2: LINE LIFF shareTargetPicker / In-client Send
  // ─────────────────────────────────────────────────────────────
  const liffId = getClientLiffId();
  if (liffId && typeof window !== "undefined") {
    try {
      const initialized = await initLiff();
      if (initialized && liffInstance) {
        const messagePayload = toLiffMessage(flexMessage, summary);

        // 2a. shareTargetPicker (sends REAL Flex Message inside LINE)
        if (liffInstance.isApiAvailable("shareTargetPicker") && liffInstance.isLoggedIn()) {
          try {
            const pickerRes = await liffInstance.shareTargetPicker([messagePayload]);
            if (pickerRes) {
              return {
                success: true,
                channel: "liff_picker",
                tier: 2,
                message: `ส่ง Flex Message เข้า LINE (${target === "group" ? "กลุ่ม" : "ส่วนตัว"}) ผ่าน LIFF Target Picker สำเร็จ (Tier 2)`,
                fallbackReason: tier1ErrorReason,
              };
            }
            return {
              success: false,
              channel: "liff_picker",
              tier: 2,
              message: "ผู้ใช้ยกเลิกการเลือกห้องแชทใน LINE",
              fallbackReason: tier1ErrorReason,
            };
          } catch (pickerErr) {
            console.warn(
              "[3-Tier Fallback] Tier 2 shareTargetPicker error, trying in-client send:",
              pickerErr,
            );
          }
        }

        // 2b. In-client direct chat send
        if (liffInstance.isInClient()) {
          try {
            await liffInstance.sendMessages([messagePayload]);
            return {
              success: true,
              channel: "liff_send",
              tier: 2,
              message: "ส่งข้อความ Flex Message เข้าแชท LINE ผ่าน LIFF สำเร็จ (Tier 2)",
              fallbackReason: tier1ErrorReason,
            };
          } catch (sendErr) {
            console.warn("[3-Tier Fallback] Tier 2 sendMessages error:", sendErr);
          }
        }
      }
    } catch (liffErr) {
      console.warn("[3-Tier Fallback] Tier 2 initialization error:", liffErr);
    }
  }

  // If intent fallback is explicitly disabled, report the exact error
  if (options.disableIntentFallback) {
    return {
      success: false,
      channel: "server_api",
      tier: 1,
      message:
        tier1ErrorReason ||
        "ไม่สามารถส่ง Flex Message ได้ กรุณาตรวจสอบ Channel Access Token หรือ User ID / Group ID",
      fallbackReason: tier1ErrorReason,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Tier 3: Web Share Intent (https://line.me/R/share) - Plain Text Fallback
  // ─────────────────────────────────────────────────────────────
  const lineIntentUrl = `https://line.me/R/share?text=${encodeURIComponent(summary)}`;
  if (typeof window !== "undefined") {
    const link = document.createElement("a");
    link.href = lineIntentUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return {
    success: true,
    channel: "line_intent",
    tier: 3,
    message: `เปิดหน้าแชร์ LINE ด้วยข้อความธรรมดา (Web Share Intent) สำเร็จ (Tier 3 Fallback)`,
    fallbackReason: tier1ErrorReason,
  };
}

/**
 * Dispatches the order to LINE utilizing the 3-Tier Fallback Architecture:
 * 1. Server Messaging API -> 2. LIFF Target Picker -> 3. Web Share Intent
 */
export async function sendOrderToLine(
  orders: LineOrderItem[],
  target: LineShareTarget = "group",
  storeName: string = DEFAULT_STORE_NAME,
): Promise<LineShareResult> {
  const resolvedStoreName = getSystemStoreName(storeName);
  const flex = buildOrderFlexMessage(
    orders,
    `ใบสั่งซื้อประจำวัน (${target === "group" ? "กลุ่ม" : "ส่วนตัว"})`,
    resolvedStoreName,
  );
  const plain = buildOrderPlainText(orders, resolvedStoreName);

  return sendWith3TierFallback({
    summary: plain,
    flexMessage: flex,
    target,
  });
}

export interface OrderFlexItem {
  name: string;
  quantity: number;
  unitName: string;
  barcode?: string | undefined;
  costPrice?: number | undefined;
  priceEstimate?: number | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  zoneId?: string | undefined;
  zoneName?: string | undefined;
  note?: string | undefined;
}

function productFromOrderItem(item: OrderFlexItem, timestamp: string): ProductItem {
  const id = item.barcode || item.name;
  return {
    id,
    sku: id,
    barcode: item.barcode || "",
    codeType: "Barcode",
    name: item.name,
    categoryId: item.categoryId || "",
    zoneId: item.zoneId || "",
    unitId: "",
    costPrice:
      item.costPrice ??
      (item.priceEstimate && item.quantity ? item.priceEstimate / item.quantity : 0),
    sellPrice: 0,
    stock: 0,
    minStock: 0,
    targetStock: 0,
    reorderQuantity: item.quantity,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Format order flex message using custom simulator JSON if available, or standard layout */
export function formatDailyOrderFlexMessage(
  items: OrderFlexItem[],
  dateStr?: string,
  storeName: string = DEFAULT_STORE_NAME,
  options?: Partial<PurchaseOrderFlexOptions>,
) {
  const resolvedDate = options?.dateStr ?? dateStr ?? new Date().toLocaleDateString("th-TH");
  const templateItems = items.map((item) => ({
    productName: item.name,
    quantity: item.quantity,
    unitName: item.unitName,
    ...(item.barcode === undefined ? {} : { barcode: item.barcode }),
    ...(item.categoryName === undefined
      ? item.categoryId === undefined
        ? {}
        : { categoryName: MasterStore.getCategoryName(item.categoryId) }
      : { categoryName: item.categoryName }),
    ...(item.zoneName === undefined
      ? item.zoneId === undefined
        ? {}
        : { zoneName: MasterStore.getZoneName(item.zoneId) }
      : { zoneName: item.zoneName }),
    ...(item.costPrice === undefined ? {} : { costPrice: item.costPrice }),
    total: item.priceEstimate ?? item.quantity * (item.costPrice ?? 0),
    ...(item.note === undefined ? {} : { note: item.note }),
  }));
  const totalQuantity = templateItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = templateItems.reduce((sum, item) => sum + (item.total ?? 0), 0);

  try {
    const customTemplate = getLatestPurchaseOrderFlexMessage();
    return populatePurchaseOrderFlexTemplate(customTemplate, {
      orderNumber: options?.orderNumber ?? "DRAFT",
      orderDate: resolvedDate,
      storeName: getSystemStoreName(options?.storeName ?? storeName),
      supplierName: options?.supplierName ?? "ซัพพลายเออร์ทั่วไป",
      items: templateItems,
      totalQuantity,
      totalCost,
      ...(options?.note === undefined ? {} : { note: options.note }),
      ...(options?.groupBy === undefined ? {} : { groupBy: options.groupBy }),
      ...(options?.showGroupHeaders === undefined
        ? {}
        : { showGroupHeaders: options.showGroupHeaders }),
    });
  } catch {
    const nowStr = new Date().toISOString();
    const lineOrders: LineOrderItem[] = items.map((i) => ({
      product: productFromOrderItem(i, nowStr),
      quantity: i.quantity,
      unitName: i.unitName,
    }));
    return buildOrderFlexMessage(
      lineOrders,
      `ใบสั่งซื้อประจำวัน (${resolvedDate})`,
      getSystemStoreName(storeName),
      options,
    );
  }
}

/**
 * Formats large purchase orders into multiple valid Flex messages.
 * A single bubble with dozens of item rows can exceed LINE's component/payload limits.
 */
export function formatDailyOrderFlexMessages(
  items: OrderFlexItem[],
  dateStr?: string,
  storeName: string = DEFAULT_STORE_NAME,
  options?: Partial<PurchaseOrderFlexOptions>,
  maxItemsPerMessage: number = 20,
) {
  const chunkSize = Math.max(1, Math.floor(maxItemsPerMessage));
  const chunks: OrderFlexItem[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return (chunks.length > 0 ? chunks : [[]]).map((chunk, index) =>
    formatDailyOrderFlexMessage(chunk, dateStr, storeName, {
      ...options,
      ...(chunks.length > 1
        ? { note: `ใบสั่งซื้อสินค้าประจำวัน (${index + 1}/${chunks.length})` }
        : {}),
    }),
  );
}

export function formatOrderPlainText(
  items: OrderFlexItem[],
  dateStr?: string,
  storeName: string = DEFAULT_STORE_NAME,
  groupBy: FlexItemGroupBy = "zone_then_category",
  showGroupHeaders: boolean = true,
): string {
  const resolvedStoreName = getSystemStoreName(storeName);
  const nowStr = new Date().toISOString();
  const lineOrders: LineOrderItem[] = items.map((i) => ({
    product: productFromOrderItem(i, nowStr),
    quantity: i.quantity,
    unitName: i.unitName,
  }));
  return buildOrderPlainText(lineOrders, resolvedStoreName, groupBy, showGroupHeaders);
}

export async function sendDailyOrderToLine(
  items: (OrderFlexItem & { product?: ProductItem })[],
  target: LineShareTarget = "group",
  dateStr?: string,
  storeName: string = DEFAULT_STORE_NAME,
  options?: Partial<PurchaseOrderFlexOptions>,
): Promise<{ success: boolean; method?: string; error?: string }> {
  const resolvedStoreName = getSystemStoreName(storeName);
  const nowStr = new Date().toISOString();
  const lineOrders: LineOrderItem[] = items.map((i) => ({
    product: i.product ?? productFromOrderItem(i, nowStr),
    quantity: i.quantity,
    unitName: i.unitName,
  }));

  const flex = buildOrderFlexMessage(
    lineOrders,
    `ใบสั่งซื้อประจำวัน (${dateStr || "วันนี้"})`,
    resolvedStoreName,
    options,
  );
  const plain = buildOrderPlainText(
    lineOrders,
    resolvedStoreName,
    options?.groupBy || "zone_then_category",
  );

  const res = await sendWith3TierFallback({
    summary: plain,
    flexMessage: flex,
    target,
  });

  const result: { success: boolean; method?: string; error?: string } = {
    success: res.success,
    method: res.channel === "liff_picker" ? "share_target_picker" : "web_intent",
  };
  if (!res.success && res.message) {
    result.error = res.message;
  }
  return result;
}

export async function sendStockAlertToLine(
  alertItems: FlexStockAlertItem[],
  target: LineShareTarget = "group",
  storeName: string = DEFAULT_STORE_NAME,
  options?: Partial<StockAlertFlexOptions>,
): Promise<{ success: boolean; method?: string; error?: string; tier?: number }> {
  const resolvedStoreName = getSystemStoreName(storeName);
  const flexMsg = createStockAlertFlexBubble(alertItems, {
    storeName: resolvedStoreName,
    ...options,
  });

  const grouped = groupAndSortFlexItems(alertItems, options?.groupBy || "zone_then_category");
  let text = `⚠️ แจ้งเตือนสต็อกสินค้าต้องสั่งซื้อ — ${resolvedStoreName}\n`;
  text += `────────────────────\n`;
  let counter = 0;
  grouped.forEach((grp) => {
    if (grp.headerTitle && options?.groupBy !== "none") {
      text += `📍 ${grp.headerTitle} (${grp.items.length} รายการ)\n`;
    }
    grp.items.forEach(({ item }) => {
      counter++;
      const statusText =
        item.status === "OUT_OF_STOCK" ? "สินค้าหมด (0)" : `เหลือ ${item.stock} ${item.unitName}`;
      text += `  ${counter}. ${item.name} ➔ ${statusText}\n`;
    });
    text += `\n`;
  });
  text += `────────────────────\nกรุณาเข้าสู่ระบบ ${resolvedStoreName} เพื่อตรวจสอบสต็อก`;

  const res = await sendWith3TierFallback({
    summary: text,
    flexMessage: flexMsg,
    target,
  });

  const result: { success: boolean; method?: string; error?: string; tier?: number } = {
    success: res.success,
    method: res.channel,
    tier: res.tier,
  };
  if (!res.success) result.error = res.message;
  return result;
}
