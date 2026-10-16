/**
 * LINE Flex Message Template for Stock Alert (แจ้งเตือนสินค้าใกล้หมด / หมดสต็อก)
 * แยกไฟล์ออกมาเฉพาะ เพื่อให้ปรับแต่ง ดีไซน์ เพิ่ม-แก้ไข ได้ง่าย
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./index";
import {
  type FlexItemGroupBy,
  groupAndSortFlexItems,
  type ItemWithCategoryAndZone,
} from "./flex-grouper";

export interface FlexStockAlertItem extends ItemWithCategoryAndZone {
  name: string;
  stock: number;
  minStock: number;
  unitName: string;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
  categoryId?: string;
  categoryName?: string;
  zoneId?: string;
  zoneName?: string;
  barcode?: string;
}

export interface StockAlertFlexOptions {
  storeName?: string | undefined;
  title?: string | undefined;
  themeColor?: string | undefined;
  groupBy?: FlexItemGroupBy | undefined;
  showGroupHeaders?: boolean | undefined;
  fontSize?: ("large" | "medium") | undefined;
  separateQuantityUnit?: boolean | undefined;
  includeZone?: boolean | undefined;
  containerType?: ("carousel" | "bubble") | undefined;
}

export function createStockAlertFlexBubble(
  items: FlexStockAlertItem[],
  options: StockAlertFlexOptions = {},
) {
  const isLargeFont = options.fontSize !== "medium";
  const groupBy = options.groupBy || "category";
  const includeZone =
    options.includeZone ??
    (groupBy === "zone" || groupBy === "zone_then_category" || groupBy === "category_then_zone");

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const storeName = getSystemStoreName(options.storeName);
  const title = options.title || "แจ้งเตือนสต็อกสินค้าต้องสั่งซื้อ";
  const headerBg = "#ef4444"; // Red for alert

  const showGroupHeaders = options.showGroupHeaders !== false;

  // Group and sort alert items (omits zone by default)
  const groupedList = groupAndSortFlexItems(items, { groupBy, includeZone });

  const itemRows: Record<string, unknown>[] = [];
  let globalIndex = 0;

  groupedList.forEach((grp, grpIdx) => {
    // Add red-tinted group header for alert items
    if (showGroupHeaders && grp.headerTitle && groupBy !== "none") {
      itemRows.push({
        type: "box",
        layout: "horizontal",
        backgroundColor: "#fef2f2",
        paddingAll: "sm",
        cornerRadius: "md",
        margin: grpIdx === 0 ? "xs" : "md",
        contents: [
          {
            type: "text",
            text: grp.headerTitle,
            size: isLargeFont ? "sm" : "xs",
            color: "#991b1b",
            weight: "bold",
            wrap: true,
            flex: 8,
          },
          {
            type: "text",
            text: `${grp.items.length} รายการ`,
            size: isLargeFont ? "xs" : "xxs",
            color: "#dc2626",
            align: "end",
            weight: "bold",
            flex: 4,
          },
        ],
      });
    }

    grp.items.forEach(({ item }) => {
      globalIndex++;
      const isOut = item.status === "OUT_OF_STOCK" || item.stock <= 0;
      itemRows.push({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        margin: "sm",
        contents: [
          {
            type: "text",
            text: `${globalIndex}. ${item.name}`,
            size: isLargeFont ? "md" : "sm",
            color: "#1f2937",
            weight: isLargeFont ? "bold" : "regular",
            flex: 5,
            wrap: true,
          },
          {
            type: "text",
            text: isOut ? "0" : `${item.stock}`,
            size: isLargeFont ? "lg" : "sm",
            color: isOut ? "#dc2626" : "#d97706",
            weight: "bold",
            align: "end",
            flex: 2,
            wrap: true,
          },
          {
            type: "text",
            text: item.unitName || "-",
            size: isLargeFont ? "md" : "sm",
            color: "#4b5563",
            weight: isLargeFont ? "bold" : "regular",
            align: "end",
            flex: 2,
            wrap: true,
          },
        ],
      });
    });
  });

  return {
    type: "flex" as const,
    altText: `⚠️ ${title} (${items.length} รายการ) - ${storeName}`,
    contents: {
      type: "bubble" as const,
      size: "giga" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: headerBg,
        paddingAll: "lg" as const,
        contents: [
          {
            type: "text" as const,
            text: `🏪 ${storeName}`,
            weight: "bold" as const,
            color: "#ffffff",
            size: isLargeFont ? ("xl" as const) : ("lg" as const),
            align: "center" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `⚠️ ${title}`,
            weight: "bold" as const,
            color: "#fee2e2",
            size: isLargeFont ? ("md" as const) : ("sm" as const),
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `📅 วันที่: ${dateStr} เวลา ${timeStr} น.`,
            color: "#fecaca",
            size: isLargeFont ? ("sm" as const) : ("xs" as const),
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
        ],
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        contents: [
          {
            type: "box" as const,
            layout: "horizontal" as const,
            contents: [
              {
                type: "text" as const,
                text: "รายการสินค้า",
                size: isLargeFont ? ("sm" as const) : ("xs" as const),
                color: "#4b5563",
                weight: "bold" as const,
                flex: 5,
              },
              {
                type: "text" as const,
                text: "คงเหลือ",
                size: isLargeFont ? ("sm" as const) : ("xs" as const),
                color: "#4b5563",
                weight: "bold" as const,
                align: "end" as const,
                flex: 2,
              },
              {
                type: "text" as const,
                text: "หน่วยนับ",
                size: isLargeFont ? ("sm" as const) : ("xs" as const),
                color: "#4b5563",
                weight: "bold" as const,
                align: "end" as const,
                flex: 2,
              },
            ],
          },
          {
            type: "separator" as const,
            margin: "sm" as const,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            margin: "md" as const,
            spacing: "md" as const,
            contents:
              itemRows.length > 0
                ? itemRows
                : [
                    {
                      type: "text" as const,
                      text: "สินค้าทุกรายการมีสต็อกเพียงพอ",
                      size: isLargeFont ? ("md" as const) : ("sm" as const),
                      color: "#10b981",
                      weight: "bold" as const,
                    },
                  ],
          },
          {
            type: "separator" as const,
            margin: "lg" as const,
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: "รวมสินค้าที่ต้องเติมสต็อก",
                size: isLargeFont ? ("md" as const) : ("sm" as const),
                color: "#374151",
              },
              {
                type: "text" as const,
                text: `${items.length} รายการ`,
                size: isLargeFont ? ("md" as const) : ("sm" as const),
                weight: "bold" as const,
                color: "#dc2626",
                align: "end" as const,
              },
            ],
          },
        ],
      },
    },
  };
}

/**
 * สร้าง Flex Message Carousel สำหรับการแจ้งเตือนสต็อกสินค้า (แบ่งตามการ์ดหมวดหมู่/ประเภท)
 */
export function createStockAlertFlexCarousel(
  items: FlexStockAlertItem[],
  options: StockAlertFlexOptions = {},
) {
  const storeName = getSystemStoreName(options.storeName);
  const isLargeFont = options.fontSize !== "medium";
  const groupBy = options.groupBy || "category";
  const includeZone =
    options.includeZone ??
    (groupBy === "zone" || groupBy === "zone_then_category" || groupBy === "category_then_zone");

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const outOfStockItems = items.filter((i) => i.status === "OUT_OF_STOCK" || i.stock <= 0);
  const lowStockItems = items.filter((i) => i.status !== "OUT_OF_STOCK" && i.stock > 0);

  // Summary Bubble
  const summaryBubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#ef4444",
      paddingAll: "lg",
      contents: [
        {
          type: "text",
          text: `🚨 ${options.title || "แจ้งเตือนสต็อกสินค้า"}`,
          weight: "bold",
          color: "#ffffff",
          size: "lg",
          align: "center",
          wrap: true,
        },
        {
          type: "text",
          text: `🏪 ${storeName}`,
          color: "#fee2e2",
          size: "sm",
          align: "center",
          margin: "xs",
          wrap: true,
        },
        {
          type: "text",
          text: `📅 ${dateStr} ${timeStr} น.`,
          color: "#fecaca",
          size: "xs",
          align: "center",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "lg",
      backgroundColor: "#ffffff",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "md",
          contents: [
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#fef2f2",
              borderColor: "#fecaca",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "md",
              flex: 6,
              contents: [
                {
                  type: "text",
                  text: "หมดสต็อก (0)",
                  size: "xxs",
                  color: "#991b1b",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `${outOfStockItems.length}`,
                  size: "xxl",
                  color: "#dc2626",
                  weight: "bold",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: "รายการด่วนที่สุด",
                  size: "xxs",
                  color: "#991b1b",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#fffbeb",
              borderColor: "#fde68a",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "md",
              flex: 6,
              contents: [
                {
                  type: "text",
                  text: "สต็อกใกล้หมด",
                  size: "xxs",
                  color: "#92400e",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `${lowStockItems.length}`,
                  size: "xxl",
                  color: "#d97706",
                  weight: "bold",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: "ต่ำกว่าจุดสั่งซื้อ",
                  size: "xxs",
                  color: "#92400e",
                },
              ],
            },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#f3f4f6",
          cornerRadius: "md",
          paddingAll: "sm",
          margin: "lg",
          contents: [
            {
              type: "text",
              text: `👉 ปัดขวาเพื่อดูสินค้าที่ต้องสั่งซื้อทั้งหมด (${items.length} รายการ)`,
              size: "xs",
              color: "#4b5563",
              align: "center",
              wrap: true,
              flex: 12,
            },
          ],
        },
      ],
    },
  };

  const groupedList = groupAndSortFlexItems(items, { groupBy, includeZone });
  const itemBubbles: Record<string, unknown>[] = [];
  const maxBubbles = 10;
  let currentCount = 1;
  let runningIndex = 0;

  for (let gIdx = 0; gIdx < groupedList.length && currentCount < maxBubbles; gIdx++) {
    const grp = groupedList[gIdx]!;
    const chunkSize = 7;
    const chunks: (typeof grp.items)[] = [];
    for (let c = 0; c < grp.items.length; c += chunkSize) {
      chunks.push(grp.items.slice(c, c + chunkSize));
    }

    for (let cIdx = 0; cIdx < chunks.length && currentCount < maxBubbles; cIdx++) {
      const chunk = chunks[cIdx]!;
      currentCount++;

      const rows: Record<string, unknown>[] = [];
      chunk.forEach(({ item }) => {
        runningIndex++;
        const isOut = item.status === "OUT_OF_STOCK" || item.stock <= 0;
        rows.push({
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          margin: "sm",
          contents: [
            {
              type: "text",
              text: `${runningIndex}. ${item.name}`,
              size: isLargeFont ? "md" : "sm",
              color: "#111827",
              weight: isLargeFont ? "bold" : "regular",
              flex: 6,
              wrap: true,
            },
            {
              type: "text",
              text: `${item.stock}/${item.minStock} ${item.unitName || "-"}`,
              size: "xs",
              color: isOut ? "#dc2626" : "#d97706",
              weight: "bold",
              align: "end",
              flex: 4,
            },
            {
              type: "text",
              text: isOut ? "หมด" : "ใกล้หมด",
              size: "xs",
              color: isOut ? "#dc2626" : "#b45309",
              weight: "bold",
              align: "end",
              flex: 2,
            },
          ],
        });
      });

      const pageLabel = chunks.length > 1 ? ` (${cIdx + 1}/${chunks.length})` : "";

      itemBubbles.push({
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#991b1b",
          paddingAll: "md",
          contents: [
            {
              type: "text",
              text: `📁 ${grp.headerTitle || "รายการสินค้า"}${pageLabel}`,
              weight: "bold",
              color: "#ffffff",
              size: "sm",
              wrap: true,
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "สินค้า",
                  size: "xs",
                  color: "#6b7280",
                  weight: "bold",
                  flex: 6,
                },
                {
                  type: "text",
                  text: "คงเหลือ/ขั้นต่ำ",
                  size: "xs",
                  color: "#6b7280",
                  weight: "bold",
                  align: "end",
                  flex: 4,
                },
                {
                  type: "text",
                  text: "สถานะ",
                  size: "xs",
                  color: "#6b7280",
                  weight: "bold",
                  align: "end",
                  flex: 2,
                },
              ],
            },
            {
              type: "separator",
              margin: "sm",
            },
            ...rows,
          ],
        },
      });
    }
  }

  return {
    type: "flex" as const,
    altText: `🚨 แจ้งเตือนสต็อกสินค้า ${storeName} (${items.length} รายการ)`,
    contents: {
      type: "carousel" as const,
      contents: [summaryBubble, ...itemBubbles],
    },
  };
}

/**
 * Universal Stock Alert Flex generator supporting both Carousel and Bubble
 */
export function createStockAlertFlex(
  items: FlexStockAlertItem[],
  options: StockAlertFlexOptions = {},
) {
  if (options.containerType === "carousel") {
    return createStockAlertFlexCarousel(items, options);
  }
  return createStockAlertFlexBubble(items, options);
}
