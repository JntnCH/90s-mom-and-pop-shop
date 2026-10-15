/**
 * Purchase Order File Exporter
 * Generates various file formats for Purchase Orders:
 * - Excel / CSV (.csv)
 * - Text (.txt)
 * - JSON (.json)
 * - PDF / HTML Printable Document
 * - Image Canvas Snapshot
 */

import { getSystemStoreName, type PurchaseOrderFlexOptions } from "./flex-templates";
import { formatDailyOrderFlexMessage, type OrderFlexItem } from "./line-service";

export interface ExportOrderItem {
  productName: string;
  barcode: string;
  categoryName?: string;
  zoneName?: string;
  quantity: number;
  unitName: string;
  costPrice: number;
  total: number;
}

export interface ExportOrderPayload {
  orderNumber: string;
  createdAt: string;
  storeName?: string;
  supplierName?: string;
  note?: string;
  items: ExportOrderItem[];
  totalQuantity: number;
  totalCost: number;
}

/**
 * Downloads a text/blob file in browser
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Export as Excel CSV (with UTF-8 BOM for Microsoft Excel Thai compatibility)
 */
export function exportOrderToCSV(order: ExportOrderPayload) {
  const headers = [
    "ลำดับ",
    "บาร์โค้ด",
    "ชื่อสินค้า",
    "หมวดหมู่",
    "โซนจัดเก็บ",
    "จำนวน",
    "หน่วยนับ",
    "ราคาทุน/หน่วย",
    "ยอดรวม (บาท)",
  ];

  const rows = order.items.map((item, idx) => [
    idx + 1,
    `"${item.barcode || ""}"`,
    `"${item.productName.replace(/"/g, '""')}"`,
    `"${item.categoryName || "-"}"`,
    `"${item.zoneName || "-"}"`,
    item.quantity,
    `"${item.unitName}"`,
    item.costPrice.toFixed(2),
    item.total.toFixed(2),
  ]);

  const resolvedStoreName = getSystemStoreName(order.storeName);

  // Header info rows
  const metaRows = [
    [`ใบสั่งซื้อสินค้า (Purchase Order)`, `เลขที่: ${order.orderNumber}`],
    [`ร้านค้า:`, `${resolvedStoreName}`],
    [`ซัพพลายเออร์:`, `${order.supplierName || "ซัพพลายเออร์ทั่วไป"}`],
    [`วันที่สั่งซื้อ:`, `${order.createdAt}`],
    [`หมายเหตุ:`, `${order.note || "-"}`],
    [],
  ];

  const totalRow = [
    "",
    "",
    "ยอดรวมทั้งสิ้น",
    "",
    "",
    order.totalQuantity,
    "หน่วย",
    "",
    order.totalCost.toFixed(2),
  ];

  const csvContent = [
    ...metaRows.map((r) => r.join(",")),
    headers.join(","),
    ...rows.map((r) => r.join(",")),
    totalRow.join(","),
  ].join("\r\n");

  // Add UTF-8 BOM (\uFEFF)
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `PO_${order.orderNumber}.csv`);
}

/**
 * 2. Export as Formatted Text (.txt)
 */
export function exportOrderToTXT(order: ExportOrderPayload) {
  const resolvedStoreName = getSystemStoreName(order.storeName);
  let txt = `====================================================\n`;
  txt += `        ใบสั่งซื้อสินค้า (PURCHASE ORDER)\n`;
  txt += `        ${resolvedStoreName}\n`;
  txt += `====================================================\n`;
  txt += `เลขที่ใบสั่งซื้อ : ${order.orderNumber}\n`;
  txt += `วันที่ออกเอกสาร  : ${order.createdAt}\n`;
  txt += `ซัพพลายเออร์    : ${order.supplierName || "ซัพพลายเออร์ทั่วไป"}\n`;
  if (order.note) {
    txt += `หมายเหตุ        : ${order.note}\n`;
  }
  txt += `----------------------------------------------------\n`;
  txt += `ลำดับ | รายการสินค้า                  | จำนวน      | รวมเงิน\n`;
  txt += `----------------------------------------------------\n`;

  order.items.forEach((item, idx) => {
    const num = String(idx + 1).padStart(2, " ");
    const name = item.productName.padEnd(28, " ");
    const qty = `${item.quantity} ${item.unitName}`.padStart(10, " ");
    const price = `฿${item.total.toFixed(2)}`.padStart(10, " ");
    txt += `${num}    ${name} ${qty} ${price}\n`;
    if (item.barcode) {
      txt += `      [Barcode: ${item.barcode}]\n`;
    }
  });

  txt += `----------------------------------------------------\n`;
  txt += `รวมจำนวนสินค้าทั้งหมด : ${order.totalQuantity} หน่วย\n`;
  txt += `ยอดรวมเงินทั้งสิ้น    : ฿${order.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`;
  txt += `====================================================\n`;
  txt += `ลงชื่อผู้จัดทำ: _______________________ วันที่: __________\n`;
  txt += `ลงชื่อผู้อนุมัติ: _______________________ วันที่: __________\n`;

  const blob = new Blob([txt], { type: "text/plain;charset=utf-8;" });
  downloadBlob(blob, `PO_${order.orderNumber}.txt`);
}

/**
 * 3. Export as Structured JSON (.json)
 */
export function exportOrderToJSON(order: ExportOrderPayload) {
  const jsonStr = JSON.stringify(order, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, `PO_${order.orderNumber}.json`);
}

/**
 * 3.1 Build populated LINE Flex Message object from order payload
 */
export function buildOrderFlexMessageFromPayload(
  order: ExportOrderPayload,
  options?: Partial<PurchaseOrderFlexOptions>,
) {
  const items: OrderFlexItem[] = order.items.map((i) => ({
    name: i.productName,
    quantity: i.quantity,
    unitName: i.unitName,
    costPrice: i.costPrice,
    barcode: i.barcode,
    categoryName: i.categoryName,
    zoneName: i.zoneName,
    priceEstimate: i.total,
    note: order.note,
  }));

  return formatDailyOrderFlexMessage(items, order.createdAt, order.storeName, {
    orderNumber: order.orderNumber,
    supplierName: order.supplierName,
    note: order.note,
    ...options,
  });
}

/**
 * 3.2 Export as LINE Flex Message JSON (.json) ready for LINE Flex Simulator or LINE Bot
 */
export function exportOrderToFlexJSON(
  order: ExportOrderPayload,
  options?: Partial<PurchaseOrderFlexOptions>,
) {
  const flexObj = buildOrderFlexMessageFromPayload(order, options);
  downloadJsonFile(flexObj, `PO_${order.orderNumber}_flex.json`);
}

/**
 * Downloads arbitrary JSON data as a formatted .json file
 */
export function downloadJsonFile(data: unknown, filename: string) {
  const jsonStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".json") ? filename : `${filename}.json`);
}

/**
 * Universal clipboard copy with hidden textarea fallback for iframes
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return Boolean(successful);
  } catch {
    return false;
  }
}

/**
 * 4. Print / Save as PDF via native print preview dialog
 */
export function printOrderAsPDF(order: ExportOrderPayload) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์เอกสาร");
    return;
  }

  const resolvedStoreName = getSystemStoreName(order.storeName);
  const itemsHtml = order.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">
          <strong>${item.productName}</strong><br/>
          <span style="font-size: 11px; color: #666; font-family: monospace;">${item.barcode || "-"}</span>
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.categoryName || "-"}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
          ${item.quantity} ${item.unitName}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: monospace;">
          ฿${item.costPrice.toFixed(2)}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; font-family: monospace;">
          ฿${item.total.toFixed(2)}
        </td>
      </tr>
    `,
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ใบสั่งซื้อสินค้า ${order.orderNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #333; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #06C755; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: bold; color: #06C755; }
          .meta-box { background: #f9f9f9; border: 1px solid #eee; padding: 10px; border-radius: 6px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f0f7f3; padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 12px; color: #166534; }
          .total-row td { background: #fcfcfc; font-weight: bold; padding: 10px 8px; border: 1px solid #ddd; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sig-box { text-align: center; width: 40%; }
          .sig-line { border-bottom: 1px solid #999; margin: 40px auto 8px auto; width: 80%; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${resolvedStoreName}</div>
            <div>ใบสั่งซื้อสินค้า (PURCHASE ORDER)</div>
            <div style="font-size: 11px; color: #666;">ระบบจัดการสต็อกสินค้า</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: bold; font-family: monospace;">${order.orderNumber}</div>
            <div style="font-size: 12px;">วันที่: ${order.createdAt}</div>
          </div>
        </div>

        <div class="meta-box">
          <strong>ผู้จัดจำหน่าย (Supplier):</strong> ${order.supplierName || "ซัพพลายเออร์ทั่วไป"}<br/>
          ${order.note ? `<strong>หมายเหตุ:</strong> ${order.note}` : ""}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ลำดับ</th>
              <th>รายการสินค้า</th>
              <th style="width: 100px; text-align: center;">หมวดหมู่</th>
              <th style="width: 90px; text-align: right;">จำนวน</th>
              <th style="width: 90px; text-align: right;">ราคาทุน/หน่วย</th>
              <th style="width: 110px; text-align: right;">ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align: right;">ยอดรวมทั้งสิ้น (${order.totalQuantity} หน่วย):</td>
              <td colspan="3" style="text-align: right; color: #06C755; font-size: 15px;">
                ฿${order.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div>ผู้จัดทำใบสั่งซื้อ</div>
            <div class="sig-line"></div>
            <div>( _________________________ )</div>
            <div style="font-size: 11px; color: #777; margin-top: 4px;">วันที่ ____/____/________</div>
          </div>
          <div class="sig-box">
            <div>ผู้อนุมัติการสั่งซื้อ</div>
            <div class="sig-line"></div>
            <div>( _________________________ )</div>
            <div style="font-size: 11px; color: #777; margin-top: 4px;">วันที่ ____/____/________</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
