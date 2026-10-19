/**
 * LINE Flex Message — Purchase Order
 * bubble = single card | carousel = 20 items/card continuous numbers sorted by category
 */
import { getSystemStoreName } from "./index";
import {
  type FlexItemGroupBy,
  groupAndSortFlexItems,
  type ItemWithCategoryAndZone,
} from "./flex-grouper";

export interface FlexOrderItem extends ItemWithCategoryAndZone {
  name: string;
  quantity: number;
  unitName: string;
  costPrice?: number | undefined;
  barcode?: string | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  zoneId?: string | undefined;
  zoneName?: string | undefined;
}

export type FlexContainerType = "carousel" | "bubble";

export interface PurchaseOrderFlexOptions {
  storeName?: string | undefined;
  note?: string | undefined;
  supplierName?: string | undefined;
  orderNumber?: string | undefined;
  dateStr?: string | undefined;
  timeStr?: string | undefined;
  themeColor?: string | undefined;
  liffId?: string | undefined;
  customBaseUrl?: string | undefined;
  groupBy?: FlexItemGroupBy | undefined;
  showGroupHeaders?: boolean | undefined;
  fontSize?: ("large" | "medium") | undefined;
  separateQuantityUnit?: boolean | undefined;
  includeZone?: boolean | undefined;
  containerType?: FlexContainerType | undefined;
  itemsPerCard?: number | undefined;
}

const LINE_MAX_CAROUSEL_BUBBLES = 12;
const DEFAULT_ITEMS_PER_CARD = 20;
type FlexBox = Record<string, unknown>;

interface Meta {
  storeName: string;
  isLargeFont: boolean;
  groupBy: FlexItemGroupBy;
  includeZone: boolean;
  showGroupHeaders: boolean;
  dateStr: string;
  timeStr: string;
  cleanNote: string;
  themeColor: string;
  dashboardUrl: string;
  reorderUrl: string;
  orderNumber: string;
  supplierName: string;
  totalQuantity: number;
  totalCost: number;
  itemsPerCard: number;
}

function resolveMeta(items: FlexOrderItem[], options: PurchaseOrderFlexOptions): Meta {
  const storeName = getSystemStoreName(options.storeName);
  const isLargeFont = options.fontSize !== "medium";
  const groupBy = options.groupBy || "category";
  const includeZone =
    options.includeZone ??
    (groupBy === "zone" || groupBy === "zone_then_category" || groupBy === "category_then_zone");
  const now = new Date();
  const dateStr =
    options.dateStr ||
    now.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  const timeStr =
    options.timeStr || now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const note = options.note || "ใบสั่งซื้อสินค้าประจำวัน";
  const cleanNote = note.replace(/\s*\(.*?\)\s*/g, "").trim() || "ใบสั่งซื้อสินค้าประจำวัน";
  const themeColor = options.themeColor || "#06c755";
  const liffId = options.liffId || "2011710264-gaZ7oEcK";
  const baseUrl = options.customBaseUrl || `https://liff.line.me/${liffId}`;
  const showGroupHeaders =
    options.showGroupHeaders !== undefined
      ? options.showGroupHeaders
      : groupBy !== "none" && groupBy !== "category_no_header" && groupBy !== "zone_no_header";
  const totalQuantity = items.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const totalCost = items.reduce(
    (s, o) => s + (Number(o.quantity) || 0) * (Number(o.costPrice) || 0),
    0,
  );
  const itemsPerCard = Math.max(1, Math.min(options.itemsPerCard ?? DEFAULT_ITEMS_PER_CARD, 30));
  return {
    storeName,
    isLargeFont,
    groupBy,
    includeZone,
    showGroupHeaders,
    dateStr,
    timeStr,
    cleanNote,
    themeColor,
    dashboardUrl: baseUrl,
    reorderUrl: `${baseUrl}/reorder`,
    orderNumber: options.orderNumber || "PO-DRAFT",
    supplierName: options.supplierName || "ซัพพลายเออร์ทั่วไป",
    totalQuantity,
    totalCost,
    itemsPerCard,
  };
}

function flattenSortedItems(
  items: FlexOrderItem[],
  meta: Meta,
): { item: FlexOrderItem; headerTitle: string }[] {
  const grouped = groupAndSortFlexItems(items, {
    groupBy: meta.groupBy,
    includeZone: meta.includeZone,
  });
  const flat: { item: FlexOrderItem; headerTitle: string }[] = [];
  for (const grp of grouped) {
    for (const { item } of grp.items) {
      flat.push({ item, headerTitle: meta.showGroupHeaders ? grp.headerTitle || "" : "" });
    }
  }
  return flat;
}

function colHeader(large: boolean): FlexBox {
  const s = large ? "sm" : "xs";
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: "รายการสินค้า",
        size: s,
        color: "#4b5563",
        weight: "bold",
        flex: 5,
        wrap: true,
      },
      {
        type: "text",
        text: "จำนวน",
        size: s,
        color: "#4b5563",
        weight: "bold",
        align: "end",
        flex: 2,
        wrap: true,
      },
      {
        type: "text",
        text: "หน่วยนับ",
        size: s,
        color: "#4b5563",
        weight: "bold",
        align: "end",
        flex: 2,
        wrap: true,
      },
    ],
  };
}

function itemRow(index: number, item: FlexOrderItem, large: boolean): FlexBox {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    margin: "sm",
    contents: [
      {
        type: "text",
        text: `${index}. ${item.name}`,
        size: large ? "md" : "sm",
        color: "#111827",
        weight: large ? "bold" : "regular",
        flex: 5,
        wrap: true,
      },
      {
        type: "text",
        text: `${item.quantity}`,
        size: large ? "lg" : "sm",
        color: "#059669",
        weight: "bold",
        align: "end",
        flex: 2,
        wrap: true,
      },
      {
        type: "text",
        text: item.unitName || "-",
        size: large ? "md" : "sm",
        color: "#374151",
        weight: large ? "bold" : "regular",
        align: "end",
        flex: 2,
        wrap: true,
      },
    ],
  };
}

function groupHeader(title: string, large: boolean, first: boolean): FlexBox {
  return {
    type: "box",
    layout: "horizontal",
    backgroundColor: "#f3f4f6",
    paddingAll: "sm",
    cornerRadius: "md",
    margin: first ? "xs" : "md",
    contents: [
      {
        type: "text",
        text: title,
        size: large ? "sm" : "xs",
        color: "#1e293b",
        weight: "bold",
        wrap: true,
        flex: 12,
      },
    ],
  };
}

function buildRows(
  slice: { item: FlexOrderItem; headerTitle: string }[],
  startIndex: number,
  large: boolean,
  showHeaders: boolean,
): FlexBox[] {
  const rows: FlexBox[] = [];
  let last = "";
  let first = true;
  slice.forEach((entry, i) => {
    if (showHeaders && entry.headerTitle && entry.headerTitle !== last) {
      rows.push(groupHeader(entry.headerTitle, large, first));
      last = entry.headerTitle;
      first = false;
    }
    rows.push(itemRow(startIndex + i, entry.item, large));
  });
  return rows;
}

function headerBox(meta: Meta, subtitle?: string): FlexBox {
  const lines: FlexBox[] = [
    {
      type: "text",
      text: `🏪 ${meta.storeName}`,
      weight: "bold",
      color: "#ffffff",
      size: meta.isLargeFont ? "xl" : "lg",
      align: "center",
      wrap: true,
    },
    {
      type: "text",
      text: `📦 ${meta.cleanNote}`,
      weight: "bold",
      color: "#e6fffa",
      size: meta.isLargeFont ? "md" : "sm",
      align: "center",
      margin: "xs",
      wrap: true,
    },
    {
      type: "text",
      text: `เลขที่: ${meta.orderNumber} • ${meta.supplierName}`,
      color: "#d1fae5",
      size: "xs",
      align: "center",
      margin: "xs",
      wrap: true,
    },
    {
      type: "text",
      text: `📅 วันที่: ${meta.dateStr} เวลา ${meta.timeStr} น.`,
      color: "#d1fae5",
      size: meta.isLargeFont ? "sm" : "xs",
      align: "center",
      margin: "xs",
      wrap: true,
    },
  ];
  if (subtitle) {
    lines.push({
      type: "text",
      text: subtitle,
      color: "#ffffff",
      size: "xs",
      align: "center",
      margin: "sm",
      weight: "bold",
      wrap: true,
    });
  }
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: meta.themeColor,
    paddingAll: "lg",
    action: { type: "uri", label: "เปิดหน้าแดชบอร์ดหลัก", uri: meta.dashboardUrl },
    contents: lines,
  };
}

function totalsBox(
  meta: Meta,
  itemCount: number,
  pageQty?: number,
  pageCost?: number,
  pageLabel?: string,
): FlexBox[] {
  const blocks: FlexBox[] = [
    { type: "separator", margin: "lg" },
    {
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        {
          type: "text",
          text: pageLabel || "จำนวนสินค้าทั้งหมด",
          size: meta.isLargeFont ? "md" : "sm",
          color: "#374151",
          flex: 5,
          wrap: true,
        },
        {
          type: "text",
          text:
            pageQty !== undefined
              ? `${itemCount} รายการ (${pageQty} หน่วย)`
              : `${itemCount} รายการ (${meta.totalQuantity} หน่วย)`,
          size: meta.isLargeFont ? "md" : "sm",
          weight: "bold",
          color: "#111827",
          align: "end",
          flex: 5,
          wrap: true,
        },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "xs",
      contents: [
        {
          type: "text",
          text: pageCost !== undefined ? "มูลค่าหน้านี้" : "ประมาณการยอดสั่งซื้อ",
          size: meta.isLargeFont ? "md" : "sm",
          color: "#374151",
          flex: 5,
          wrap: true,
        },
        {
          type: "text",
          text: `฿${(pageCost !== undefined ? pageCost : meta.totalCost).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
          })}`,
          size: meta.isLargeFont ? "xl" : "md",
          weight: "bold",
          color: "#059669",
          align: "end",
          flex: 5,
          wrap: true,
        },
      ],
    },
  ];
  if (pageCost !== undefined) {
    blocks.push({
      type: "box",
      layout: "horizontal",
      margin: "xs",
      contents: [
        { type: "text", text: "ยอดรวมทั้งใบ", size: "xs", color: "#6b7280", flex: 5, wrap: true },
        {
          type: "text",
          text: `฿${meta.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} (${meta.totalQuantity} หน่วย)`,
          size: "xs",
          color: "#6b7280",
          align: "end",
          flex: 5,
          wrap: true,
        },
      ],
    });
  }
  return blocks;
}

function footerBox(meta: Meta): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "md",
    paddingTop: "none",
    contents: [
      {
        type: "button",
        style: "primary",
        color: "#06C755",
        height: meta.isLargeFont ? "md" : "sm",
        action: { type: "uri", label: "📊 เปิดแดชบอร์ดร้าน (หน้าแรก)", uri: meta.dashboardUrl },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: { type: "uri", label: "📋 เปิดหน้าใบสั่งซื้อ", uri: meta.reorderUrl },
      },
    ],
  };
}

function bubbleContents(
  meta: Meta,
  itemRows: FlexBox[],
  totals: FlexBox[],
  subtitle?: string,
  size: "mega" | "giga" = "mega",
): FlexBox {
  return {
    type: "bubble",
    size,
    header: headerBox(meta, subtitle),
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        colHeader(meta.isLargeFont),
        { type: "separator", margin: "sm" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "md",
          contents:
            itemRows.length > 0
              ? itemRows
              : [
                  {
                    type: "text",
                    text: "ไม่มีรายการสินค้า",
                    size: meta.isLargeFont ? "md" : "sm",
                    color: "#9ca3af",
                    wrap: true,
                  },
                ],
        },
        ...totals,
      ],
    },
    footer: footerBox(meta),
  };
}

export function createPurchaseOrderFlexBubble(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const meta = resolveMeta(items, options);
  const flat = flattenSortedItems(items, meta);
  const rows = buildRows(flat, 1, meta.isLargeFont, meta.showGroupHeaders);
  return {
    type: "flex" as const,
    altText: `📦 ${meta.storeName} — ${meta.cleanNote} (${items.length} รายการ, รวม ${meta.totalQuantity} หน่วย)`,
    contents: bubbleContents(meta, rows, totalsBox(meta, items.length)),
  };
}

export function createFullBleedPurchaseOrderFlexBubble(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const meta = resolveMeta(items, options);
  const flat = flattenSortedItems(items, meta);
  const maxItems = 8;
  const shown = flat.slice(0, maxItems);
  const rows = buildRows(shown, 1, meta.isLargeFont, meta.showGroupHeaders);
  if (flat.length > maxItems) {
    rows.push({
      type: "text",
      text: `... และอีก ${flat.length - maxItems} รายการ (เปิดดูเต็มในระบบ)`,
      size: "xs",
      color: "#0284c7",
      align: "center",
      margin: "md",
    });
  }
  return {
    type: "flex" as const,
    altText: `📦 ${meta.storeName} — สั่งด่วน ใบสั่งซื้อสินค้า (${items.length} รายการ, ฿${meta.totalCost.toLocaleString()})`,
    contents: bubbleContents(meta, rows, totalsBox(meta, items.length), undefined, "giga"),
  };
}

export function createPurchaseOrderFlexCarousel(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const meta = resolveMeta(items, options);
  const flat = flattenSortedItems(items, meta);
  const perCard = meta.itemsPerCard;

  if (flat.length === 0) {
    return {
      type: "flex" as const,
      altText: `📦 ${meta.storeName} — ${meta.cleanNote} (ไม่มีรายการ)`,
      contents: {
        type: "carousel" as const,
        contents: [bubbleContents(meta, [], totalsBox(meta, 0), "ไม่มีรายการสินค้า")],
      },
    };
  }

  const bubbles: FlexBox[] = [];
  const maxShown = LINE_MAX_CAROUSEL_BUBBLES * perCard;
  const shown = flat.slice(0, maxShown);
  const pages = Math.ceil(shown.length / perCard);

  for (let page = 0; page < pages; page++) {
    const start = page * perCard;
    const end = Math.min(start + perCard, shown.length);
    const slice = shown.slice(start, end);
    const startNum = start + 1;
    const endNum = end;
    const pageQty = slice.reduce((s, e) => s + (Number(e.item.quantity) || 0), 0);
    const pageCost = slice.reduce(
      (s, e) => s + (Number(e.item.quantity) || 0) * (Number(e.item.costPrice) || 0),
      0,
    );
    const rows = buildRows(slice, startNum, meta.isLargeFont, meta.showGroupHeaders);
    if (page === pages - 1 && flat.length > maxShown) {
      rows.push({
        type: "text",
        text: `... และอีก ${flat.length - maxShown} รายการ (เปิดดูเต็มในระบบ)`,
        size: "xs",
        color: "#0284c7",
        align: "center",
        margin: "sm",
      });
    }
    const subtitle =
      pages > 1
        ? `หน้า ${page + 1}/${pages} • รายการ ${startNum}–${endNum} จาก ${flat.length}`
        : `รายการ ${startNum}–${endNum} จาก ${flat.length}`;
    bubbles.push(
      bubbleContents(
        meta,
        rows,
        totalsBox(meta, slice.length, pageQty, pageCost, "รวมหน้านี้"),
        subtitle,
      ),
    );
  }

  return {
    type: "flex" as const,
    altText: `📦 ${meta.storeName} — ${meta.cleanNote} (${items.length} รายการ, รวม ${meta.totalQuantity} หน่วย)`,
    contents: { type: "carousel" as const, contents: bubbles },
  };
}

export function createPurchaseOrderFlex(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  if (options.containerType === "carousel") {
    return createPurchaseOrderFlexCarousel(items, options);
  }
  return createPurchaseOrderFlexBubble(items, options);
}
