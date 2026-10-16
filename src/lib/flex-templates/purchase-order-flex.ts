/**
 * LINE Flex Message Template for Purchase Orders (ใบสั่งซื้อสินค้า)
 * ออกแบบโครงสร้าง:
 * 1. ชื่อร้านขึ้นก่อนเด่นชัด (รองรับ options.storeName และ Fallback กลาง: "ร้าน โชห่วยยุค 90s")
 * 2. ข้อมูลไม่ซ้ำซ้อน (วันที่แสดงบรรทัดเดียว ไม่ซ้ำในชื่อหัวข้อ)
 * 3. ทุกตัวอักษร wrap: true ไม่ออกนอกบล็อกและไม่โดนตัดเป็น ...
 * 4. รองรับการแทนที่ด้วย Custom JSON จาก LINE Simulator โดยไม่อิงชื่อร้าน hardcode
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./index";
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
}

/**
 * สร้าง Flex Message Bubble สำหรับใบสั่งซื้อสินค้าประจำวัน
 * รูปแบบแสดงผล: แยกคอลัมน์ [รายการ] [จำนวน] [หน่วยนับ] ออกจากกันชัดเจน พร้อมข้อความขนาดใหญ่
 * จัดกลุ่มตามหมวดหมู่ (ไม่แสดงโซน) พร้อมยอดรวมและมูลค่าโดยประมาณ
 * พร้อมปุ่มลัดสำหรับเปิดหน้าแดชบอร์ดหลัก และเปิดดูใบสั่งซื้อ
 */
export function createPurchaseOrderFlexBubble(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const storeName = getSystemStoreName(options.storeName);
  const isLargeFont = options.fontSize !== "medium";
  const groupBy = options.groupBy || "category";
  const includeZone =
    options.includeZone ??
    (groupBy === "zone" || groupBy === "zone_then_category" || groupBy === "category_then_zone");

  const now = new Date();
  const dateStr =
    options.dateStr ||
    now.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const timeStr =
    options.timeStr ||
    now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const note = options.note || "ใบสั่งซื้อสินค้าประจำวัน";
  // Clean note so date is not repeated if passed in note
  const cleanNote = note.replace(/\s*\(.*?\)\s*/g, "").trim() || "ใบสั่งซื้อสินค้าประจำวัน";
  const themeColor = options.themeColor || "#06c755";
  const liffId = options.liffId || "2011710264-gaZ7oEcK";
  const baseUrl = options.customBaseUrl || `https://liff.line.me/${liffId}`;
  const dashboardUrl = `${baseUrl}`;
  const reorderUrl = `${baseUrl}/reorder`;

  const showGroupHeaders =
    options.showGroupHeaders !== undefined
      ? options.showGroupHeaders
      : groupBy !== "none" && groupBy !== "category_no_header" && groupBy !== "zone_no_header";

  const totalQuantity = items.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
  const totalCost = items.reduce(
    (sum, o) => sum + (Number(o.quantity) || 0) * (Number(o.costPrice) || 0),
    0,
  );

  // Group and sort items (omits zone by default)
  const groupedList = groupAndSortFlexItems(items, { groupBy, includeZone });

  const itemRows: Record<string, unknown>[] = [];
  let globalIndex = 0;

  groupedList.forEach((grp, grpIdx) => {
    // Add stylish group header banner if enabled and multiple or named groups exist
    if (
      showGroupHeaders &&
      grp.headerTitle &&
      groupBy !== "none" &&
      groupBy !== "category_no_header" &&
      groupBy !== "zone_no_header"
    ) {
      itemRows.push({
        type: "box",
        layout: "horizontal",
        backgroundColor: "#f3f4f6",
        paddingAll: "sm",
        cornerRadius: "md",
        margin: grpIdx === 0 ? "xs" : "md",
        contents: [
          {
            type: "text",
            text: grp.headerTitle,
            size: isLargeFont ? "sm" : "xs",
            color: "#1e293b",
            weight: "bold",
            wrap: true,
            flex: 8,
          },
          {
            type: "text",
            text: `${grp.items.length} รายการ`,
            size: isLargeFont ? "xs" : "xxs",
            color: "#64748b",
            align: "end",
            weight: "bold",
            flex: 4,
          },
        ],
      });
    }

    grp.items.forEach(({ item }) => {
      globalIndex++;
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
            color: "#111827",
            weight: isLargeFont ? "bold" : "regular",
            flex: 5,
            wrap: true,
          },
          {
            type: "text",
            text: `${item.quantity}`,
            size: isLargeFont ? "lg" : "sm",
            color: "#059669",
            weight: "bold",
            align: "end",
            flex: 2,
            wrap: true,
          },
          {
            type: "text",
            text: item.unitName || "-",
            size: isLargeFont ? "md" : "sm",
            color: "#374151",
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
    altText: `📦 ${storeName} — ${cleanNote} (${items.length} รายการ, รวม ${totalQuantity} หน่วย)`,
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: themeColor,
        paddingAll: "lg" as const,
        action: {
          type: "uri" as const,
          label: "เปิดหน้าแดชบอร์ดหลัก",
          uri: dashboardUrl,
        },
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
            text: `📦 ${cleanNote}`,
            weight: "bold" as const,
            color: "#e6fffa",
            size: isLargeFont ? ("md" as const) : ("sm" as const),
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `📅 วันที่: ${dateStr} เวลา ${timeStr} น.`,
            color: "#d1fae5",
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
                wrap: true,
              },
              {
                type: "text" as const,
                text: "จำนวน",
                size: isLargeFont ? ("sm" as const) : ("xs" as const),
                color: "#4b5563",
                weight: "bold" as const,
                align: "end" as const,
                flex: 2,
                wrap: true,
              },
              {
                type: "text" as const,
                text: "หน่วยนับ",
                size: isLargeFont ? ("sm" as const) : ("xs" as const),
                color: "#4b5563",
                weight: "bold" as const,
                align: "end" as const,
                flex: 2,
                wrap: true,
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
                      text: "ไม่มีรายการสินค้า",
                      size: isLargeFont ? ("md" as const) : ("sm" as const),
                      color: "#9ca3af",
                      wrap: true,
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
                text: "จำนวนสินค้าทั้งหมด",
                size: isLargeFont ? ("md" as const) : ("sm" as const),
                color: "#374151",
                flex: 5,
                wrap: true,
              },
              {
                type: "text" as const,
                text: `${items.length} รายการ (${totalQuantity} หน่วย)`,
                size: isLargeFont ? ("md" as const) : ("sm" as const),
                weight: "bold" as const,
                color: "#111827",
                align: "end" as const,
                flex: 5,
                wrap: true,
              },
            ],
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "xs" as const,
            contents: [
              {
                type: "text" as const,
                text: "ประมาณการยอดสั่งซื้อ",
                size: isLargeFont ? ("md" as const) : ("sm" as const),
                color: "#374151",
                flex: 5,
                wrap: true,
              },
              {
                type: "text" as const,
                text: `฿${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
                size: isLargeFont ? ("xl" as const) : ("md" as const),
                weight: "bold" as const,
                color: "#059669",
                align: "end" as const,
                flex: 5,
                wrap: true,
              },
            ],
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "sm" as const,
        paddingAll: "md" as const,
        paddingTop: "none" as const,
        contents: [
          {
            type: "button" as const,
            style: "primary" as const,
            color: "#06C755",
            height: isLargeFont ? ("md" as const) : ("sm" as const),
            action: {
              type: "uri" as const,
              label: "📊 เปิดแดชบอร์ดร้าน (หน้าแรก)",
              uri: dashboardUrl,
            },
          },
          {
            type: "button" as const,
            style: "secondary" as const,
            height: isLargeFont ? ("md" as const) : ("sm" as const),
            action: {
              type: "uri" as const,
              label: "📋 จัดการใบสั่งซื้อ & ตรวจรับ",
              uri: reorderUrl,
            },
          },
        ],
      },
    },
  };
}

/**
 * Creates Full-Bleed ("เต็มจอ") LINE Flex Bubble (Matching sample image style)
 * Size: giga, Zero side padding, Dual comparison cards, Floating pill, and Bottom navy action bar with orange "คลิก" button
 */
export function createFullBleedPurchaseOrderFlexBubble(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const storeName = getSystemStoreName(options.storeName);
  const now = new Date();
  const dateStr =
    options.dateStr ||
    now.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const timeStr =
    options.timeStr ||
    now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const liffId = options.liffId || "2011710264-gaZ7oEcK";
  const baseUrl = options.customBaseUrl || `https://liff.line.me/${liffId}`;
  const reorderUrl = `${baseUrl}/reorder`;

  const totalQuantity = items.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
  const totalCost = items.reduce(
    (sum, o) => sum + (Number(o.quantity) || 0) * (Number(o.costPrice) || 0),
    0,
  );

  const maxItems = Math.min(items.length, 8);
  const itemRows: Record<string, unknown>[] = [];

  for (let i = 0; i < maxItems; i++) {
    const item = items[i];
    if (!item) break;
    itemRows.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: `${i + 1}. ${item.name}`,
          size: "sm",
          color: "#111827",
          weight: "bold",
          flex: 5,
          wrap: true,
        },
        {
          type: "text",
          text: `${item.quantity} ${item.unitName || "-"}`,
          size: "sm",
          color: "#059669",
          weight: "bold",
          align: "end",
          flex: 3,
        },
        {
          type: "text",
          text: `฿${((item.costPrice || 0) * item.quantity).toFixed(0)}`,
          size: "sm",
          color: "#374151",
          weight: "bold",
          align: "end",
          flex: 2,
        },
      ],
    });
  }

  if (items.length > maxItems) {
    itemRows.push({
      type: "text",
      text: `... และอีก ${items.length - maxItems} รายการ (เปิดดูเต็มในระบบ)`,
      size: "xs",
      color: "#0284c7",
      align: "center",
      margin: "md",
    });
  }

  return {
    type: "flex" as const,
    altText: `📦 ${storeName} — สั่งด่วน ใบสั่งซื้อสินค้า (${items.length} รายการ, ฿${totalCost.toLocaleString()})`,
    contents: {
      type: "bubble" as const,
      size: "giga" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: "#f97316",
        paddingAll: "xl" as const,
        contents: [
          {
            type: "box" as const,
            layout: "horizontal" as const,
            contents: [
              {
                type: "text" as const,
                text: "🎗️ โชห่วยยุค90s",
                size: "xs" as const,
                color: "#ffedd5",
                weight: "bold" as const,
                flex: 7,
              },
              {
                type: "box" as const,
                layout: "vertical" as const,
                backgroundColor: "#ffffff",
                cornerRadius: "md" as const,
                paddingAll: "xs" as const,
                flex: 5,
                contents: [
                  {
                    type: "text" as const,
                    text: `🏪 ${storeName}`,
                    size: "xxs" as const,
                    color: "#0284c7",
                    weight: "bold" as const,
                    align: "center" as const,
                  },
                ],
              },
            ],
          },
          {
            type: "text" as const,
            text: "สั่งดี สั่งไว ที่นี่ให้ครบ...",
            size: "xl" as const,
            weight: "bold" as const,
            color: "#ffffff",
            margin: "md" as const,
            wrap: true,
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            backgroundColor: "#0284c7",
            cornerRadius: "sm" as const,
            paddingAll: "xs" as const,
            margin: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: `📦 ใบสั่งซื้อสินค้าด่วน • เลขที่ ${options.orderNumber || "PO-DRAFT"}`,
                size: "xs" as const,
                color: "#ffffff",
                weight: "bold" as const,
                align: "center" as const,
              },
            ],
          },
          {
            type: "text" as const,
            text: `📅 วันที่: ${dateStr} เวลา ${timeStr} น.`,
            size: "xs" as const,
            color: "#ffedd5",
            margin: "xs" as const,
          },
        ],
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        paddingAll: "lg" as const,
        backgroundColor: "#ffffff",
        contents: [
          // Dual comparison cards
          {
            type: "box" as const,
            layout: "horizontal" as const,
            spacing: "md" as const,
            contents: [
              {
                type: "box" as const,
                layout: "vertical" as const,
                backgroundColor: "#f8fafc",
                borderColor: "#e2e8f0",
                borderWidth: "1px" as const,
                cornerRadius: "lg" as const,
                paddingAll: "md" as const,
                flex: 5,
                contents: [
                  {
                    type: "text" as const,
                    text: "📋 จำนวนรายการ",
                    size: "xxs" as const,
                    color: "#64748b",
                    weight: "bold" as const,
                  },
                  {
                    type: "text" as const,
                    text: `${items.length}`,
                    size: "xxl" as const,
                    color: "#0284c7",
                    weight: "bold" as const,
                    margin: "xs" as const,
                  },
                  {
                    type: "text" as const,
                    text: `รวม ${totalQuantity} หน่วย`,
                    size: "xxs" as const,
                    color: "#64748b",
                  },
                ],
              },
              {
                type: "box" as const,
                layout: "vertical" as const,
                backgroundColor: "#eff6ff",
                borderColor: "#bfdbfe",
                borderWidth: "1px" as const,
                cornerRadius: "lg" as const,
                paddingAll: "md" as const,
                flex: 5,
                contents: [
                  {
                    type: "text" as const,
                    text: "💰 ยอดสั่งซื้อรวม",
                    size: "xxs" as const,
                    color: "#1d4ed8",
                    weight: "bold" as const,
                  },
                  {
                    type: "text" as const,
                    text: `฿${Math.round(totalCost).toLocaleString()}`,
                    size: "xl" as const,
                    color: "#059669",
                    weight: "bold" as const,
                    margin: "xs" as const,
                  },
                  {
                    type: "text" as const,
                    text: "ราคาประเมินเบื้องต้น",
                    size: "xxs" as const,
                    color: "#059669",
                  },
                ],
              },
            ],
          },
          // Highlight Pill
          {
            type: "box" as const,
            layout: "horizontal" as const,
            backgroundColor: "#0284c7",
            cornerRadius: "xxl" as const,
            paddingAll: "sm" as const,
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: `⚡ ยอดสุทธิ ฿${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} (${totalQuantity} ชิ้น)`,
                size: "xs" as const,
                color: "#ffffff",
                weight: "bold" as const,
                align: "center" as const,
              },
            ],
          },
          // Table header
          {
            type: "separator" as const,
            margin: "md" as const,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            margin: "md" as const,
            contents: itemRows,
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "horizontal" as const,
        backgroundColor: "#041633",
        paddingAll: "md" as const,
        contents: [
          {
            type: "box" as const,
            layout: "vertical" as const,
            flex: 7,
            contents: [
              {
                type: "text" as const,
                text: "ตรวจสอบและจัดการใบสั่งซื้อได้ทันที",
                size: "xs" as const,
                color: "#ffffff",
                weight: "bold" as const,
                wrap: true,
              },
              {
                type: "text" as const,
                text: `ระบบสต็อก MiniMark • ${storeName}`,
                size: "xxs" as const,
                color: "#93c5fd",
                wrap: true,
              },
            ],
          },
          {
            type: "button" as const,
            style: "primary" as const,
            color: "#f97316",
            height: "sm" as const,
            flex: 3,
            action: {
              type: "uri" as const,
              label: "คลิก",
              uri: reorderUrl,
            },
          },
        ],
      },
    },
  };
}

/**
 * สร้าง Flex Message Carousel สำหรับใบสั่งซื้อสินค้าประจำวัน
 * รูปแบบแสดงผล: การ์ดแรกเป็นสรุปภาพรวม (Summary Card) และการ์ดถัดไปแยกตามหมวดหมู่/หน้า
 * สไลด์ในหน้าจอ LINE ได้อย่างสวยงาม ตรงตามมาตรฐาน LINE Flex Carousel
 */
export function createPurchaseOrderFlexCarousel(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const storeName = getSystemStoreName(options.storeName);
  const isLargeFont = options.fontSize !== "medium";
  const groupBy = options.groupBy || "category";
  const includeZone =
    options.includeZone ??
    (groupBy === "zone" || groupBy === "zone_then_category" || groupBy === "category_then_zone");

  const now = new Date();
  const dateStr =
    options.dateStr ||
    now.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const timeStr =
    options.timeStr ||
    now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const note = options.note || "ใบสั่งซื้อสินค้าประจำวัน";
  const cleanNote = note.replace(/\s*\(.*?\)\s*/g, "").trim() || "ใบสั่งซื้อสินค้าประจำวัน";
  const themeColor = options.themeColor || "#06c755";
  const liffId = options.liffId || "2011710264-gaZ7oEcK";
  const baseUrl = options.customBaseUrl || `https://liff.line.me/${liffId}`;
  const reorderUrl = `${baseUrl}/reorder`;

  const totalQuantity = items.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
  const totalCost = items.reduce(
    (sum, o) => sum + (Number(o.quantity) || 0) * (Number(o.costPrice) || 0),
    0,
  );

  const groupedList = groupAndSortFlexItems(items, { groupBy, includeZone });

  // Bubble 1: Overview Summary Card
  const summaryBubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: themeColor,
      paddingAll: "lg",
      contents: [
        {
          type: "text",
          text: `🏪 ${storeName}`,
          weight: "bold",
          color: "#ffffff",
          size: isLargeFont ? "xl" : "lg",
          align: "center",
          wrap: true,
        },
        {
          type: "text",
          text: `📦 ${cleanNote}`,
          weight: "bold",
          color: "#e6fffa",
          size: isLargeFont ? "md" : "sm",
          align: "center",
          margin: "xs",
          wrap: true,
        },
        {
          type: "text",
          text: `เลขที่: ${options.orderNumber || "PO-DRAFT"} • ${options.supplierName || "ซัพพลายเออร์ทั่วไป"}`,
          color: "#d1fae5",
          size: "xs",
          align: "center",
          margin: "xs",
          wrap: true,
        },
        {
          type: "text",
          text: `📅 ${dateStr} เวลา ${timeStr} น.`,
          color: "#d1fae5",
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
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#f0fdf4",
              borderColor: "#bbf7d0",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "md",
              flex: 4,
              contents: [
                {
                  type: "text",
                  text: "รายการ",
                  size: "xxs",
                  color: "#166534",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `${items.length}`,
                  size: "xl",
                  color: "#15803d",
                  weight: "bold",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: "รายการ",
                  size: "xxs",
                  color: "#166534",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#eff6ff",
              borderColor: "#bfdbfe",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "md",
              flex: 4,
              contents: [
                {
                  type: "text",
                  text: "จำนวนชิ้น",
                  size: "xxs",
                  color: "#1e40af",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `${totalQuantity}`,
                  size: "xl",
                  color: "#2563eb",
                  weight: "bold",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: "ชิ้นรวม",
                  size: "xxs",
                  color: "#1e40af",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#fefce8",
              borderColor: "#fef08a",
              borderWidth: "1px",
              cornerRadius: "md",
              paddingAll: "md",
              flex: 4,
              contents: [
                {
                  type: "text",
                  text: "ยอดเงินรวม",
                  size: "xxs",
                  color: "#854d0e",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: `฿${Math.round(totalCost).toLocaleString()}`,
                  size: "md",
                  color: "#ca8a04",
                  weight: "bold",
                  margin: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: "ประเมิน",
                  size: "xxs",
                  color: "#854d0e",
                },
              ],
            },
          ],
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          contents: [
            {
              type: "text",
              text: `📂 สรุปกลุ่มสินค้า (${groupedList.length} กลุ่ม)`,
              size: "xs",
              color: "#374151",
              weight: "bold",
            },
            ...groupedList.slice(0, 4).map((grp) => ({
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: `• ${grp.headerTitle || "สินค้าทั่วไป"}`,
                  size: "xs",
                  color: "#4b5563",
                  flex: 8,
                  wrap: true,
                },
                {
                  type: "text",
                  text: `${grp.items.length} รายการ`,
                  size: "xs",
                  color: "#059669",
                  weight: "bold",
                  align: "end",
                  flex: 4,
                },
              ],
            })),
            ...(groupedList.length > 4
              ? [
                  {
                    type: "text",
                    text: `... และอีก ${groupedList.length - 4} กลุ่ม`,
                    size: "xxs",
                    color: "#9ca3af",
                    margin: "xs",
                  },
                ]
              : []),
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
              text: "👉 ปัดซ้าย/ขวา เพื่อดูการ์ดรายการสินค้าแยกตามหมวดหมู่",
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
    footer: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#f9fafb",
      paddingAll: "md",
      contents: [
        {
          type: "button",
          style: "primary",
          color: themeColor,
          height: "sm",
          action: {
            type: "uri",
            label: "เปิดดูใบสั่งซื้อในระบบ",
            uri: reorderUrl,
          },
        },
      ],
    },
  };

  const itemBubbles: Record<string, unknown>[] = [];
  const maxBubbles = 10; // Reserve bubble 1 for summary, up to 9 item bubbles

  // Chunk groups or items into bubbles
  let currentBubbleCount = 1;
  let runningIndex = 0;

  for (let gIdx = 0; gIdx < groupedList.length && currentBubbleCount < maxBubbles; gIdx++) {
    const grp = groupedList[gIdx]!;
    // Chunk items if group is large (> 7 items)
    const chunkSize = 7;
    const chunks: (typeof grp.items)[] = [];
    for (let c = 0; c < grp.items.length; c += chunkSize) {
      chunks.push(grp.items.slice(c, c + chunkSize));
    }

    for (let cIdx = 0; cIdx < chunks.length && currentBubbleCount < maxBubbles; cIdx++) {
      const chunk = chunks[cIdx]!;
      currentBubbleCount++;

      const groupQty = chunk.reduce((s, it) => s + (Number(it.item.quantity) || 0), 0);
      const groupCost = chunk.reduce(
        (s, it) => s + (Number(it.item.quantity) || 0) * (Number(it.item.costPrice) || 0),
        0,
      );

      const rows: Record<string, unknown>[] = [];
      chunk.forEach(({ item }) => {
        runningIndex++;
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
              flex: 5,
              wrap: true,
            },
            {
              type: "text",
              text: `${item.quantity}`,
              size: isLargeFont ? "lg" : "sm",
              color: "#059669",
              weight: "bold",
              align: "end",
              flex: 2,
            },
            {
              type: "text",
              text: item.unitName || "-",
              size: isLargeFont ? "md" : "sm",
              color: "#374151",
              weight: isLargeFont ? "bold" : "regular",
              align: "end",
              flex: 2,
            },
          ],
        });
      });

      const pageLabel = chunks.length > 1 ? ` (${cIdx + 1}/${chunks.length})` : "";
      const bubbleTitle = `${grp.headerTitle || "รายการสินค้า"}${pageLabel}`;

      itemBubbles.push({
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1e293b",
          paddingAll: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: `📁 ${bubbleTitle}`,
                  weight: "bold",
                  color: "#ffffff",
                  size: "sm",
                  flex: 8,
                  wrap: true,
                },
                {
                  type: "text",
                  text: `${chunk.length} รายการ`,
                  weight: "bold",
                  color: "#93c5fd",
                  size: "xs",
                  align: "end",
                  flex: 4,
                },
              ],
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
                  text: "รายการสินค้า",
                  size: "xs",
                  color: "#6b7280",
                  weight: "bold",
                  flex: 5,
                },
                {
                  type: "text",
                  text: "จำนวน",
                  size: "xs",
                  color: "#6b7280",
                  weight: "bold",
                  align: "end",
                  flex: 2,
                },
                {
                  type: "text",
                  text: "หน่วย",
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
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                {
                  type: "text",
                  text: `รวมหน้านี้: ${groupQty} ชิ้น`,
                  size: "xs",
                  color: "#059669",
                  weight: "bold",
                  flex: 6,
                },
                {
                  type: "text",
                  text: `฿${Math.round(groupCost).toLocaleString()}`,
                  size: "xs",
                  color: "#1e293b",
                  weight: "bold",
                  align: "end",
                  flex: 6,
                },
              ],
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#f8fafc",
          paddingAll: "sm",
          contents: [
            {
              type: "button",
              style: "link",
              height: "sm",
              color: "#0284c7",
              action: {
                type: "uri",
                label: "เปิดจัดการใบสั่งซื้อ",
                uri: reorderUrl,
              },
            },
          ],
        },
      });
    }
  }

  // If there are remaining items not shown due to bubble limit
  const remainingCount = items.length - runningIndex;
  if (remainingCount > 0 && itemBubbles.length > 0) {
    const lastBubble = itemBubbles[itemBubbles.length - 1];
    if (lastBubble && typeof lastBubble === "object" && "body" in lastBubble) {
      const body = lastBubble.body as { contents?: Record<string, unknown>[] };
      if (Array.isArray(body.contents)) {
        body.contents.push({
          type: "text",
          text: `... และอีก ${remainingCount} รายการ (เปิดดูเต็มในระบบ)`,
          size: "xs",
          color: "#0284c7",
          align: "center",
          margin: "sm",
        });
      }
    }
  }

  const allBubbles = [summaryBubble, ...itemBubbles];

  return {
    type: "flex" as const,
    altText: `📦 ${storeName} — ${cleanNote} (${items.length} รายการ, รวม ${totalQuantity} หน่วย)`,
    contents: {
      type: "carousel" as const,
      contents: allBubbles,
    },
  };
}

/**
 * Universal Purchase Order Flex generator supporting both Carousel and Bubble
 */
export function createPurchaseOrderFlex(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  if (options.containerType === "carousel") {
    return createPurchaseOrderFlexCarousel(items, options);
  }
  return createPurchaseOrderFlexBubble(items, options);
}
