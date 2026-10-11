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
  costPrice?: number;
  barcode?: string;
  categoryId?: string;
  categoryName?: string;
  zoneId?: string;
  zoneName?: string;
}

export interface PurchaseOrderFlexOptions {
  storeName?: string;
  note?: string;
  supplierName?: string;
  orderNumber?: string;
  dateStr?: string;
  timeStr?: string;
  themeColor?: string;
  liffId?: string;
  customBaseUrl?: string;
  groupBy?: FlexItemGroupBy;
  showGroupHeaders?: boolean;
  fontSize?: "large" | "medium";
  separateQuantityUnit?: boolean;
  includeZone?: boolean;
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
  const separateQuantityUnit = options.separateQuantityUnit !== false;
  const includeZone = options.includeZone === true; // ค่าเริ่มต้น: ไม่ต้องการโซนใน Flex Message

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

  const groupBy = options.groupBy || "category";
  const showGroupHeaders = options.showGroupHeaders !== false;

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
    if (showGroupHeaders && grp.headerTitle && groupBy !== "none") {
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
      if (separateQuantityUnit) {
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
      } else {
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
              flex: 6,
              wrap: true,
            },
            {
              type: "text",
              text: `${item.quantity} ${item.unitName}`,
              size: isLargeFont ? "md" : "sm",
              color: "#059669",
              weight: "bold",
              align: "end",
              flex: 4,
              wrap: true,
            },
          ],
        });
      }
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
          separateQuantityUnit
            ? {
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
              }
            : {
                type: "box" as const,
                layout: "horizontal" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: "รายการสินค้าที่จะสั่งซื้อ",
                    size: isLargeFont ? ("sm" as const) : ("xs" as const),
                    color: "#6b7280",
                    weight: "bold" as const,
                    flex: 6,
                    wrap: true,
                  },
                  {
                    type: "text" as const,
                    text: "จำนวน / หน่วยนับ",
                    size: isLargeFont ? ("sm" as const) : ("xs" as const),
                    color: "#6b7280",
                    weight: "bold" as const,
                    align: "end" as const,
                    flex: 4,
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
