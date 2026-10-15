/**
 * Slip Image Generator for LINE & Export
 * Generates crystal-clear, high-DPI PNG slips for Purchase Orders and Stock Alerts
 * that can be sent directly to LINE via Messaging API, LIFF shareTargetPicker, or Web Share.
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./flex-templates";

export interface SlipOrderItem {
  name: string;
  quantity: number;
  unitName: string;
  costPrice?: number | undefined;
  total?: number | undefined;
  barcode?: string | undefined;
  zoneName?: string | undefined;
  categoryName?: string | undefined;
  note?: string | undefined;
}

export interface PurchaseOrderSlipData {
  orderNumber: string;
  createdAt: string;
  storeName?: string | undefined;
  supplierName?: string | undefined;
  items: SlipOrderItem[];
  totalQuantity: number;
  totalCost: number;
  note?: string | undefined;
}

export interface StockAlertSlipItem {
  name: string;
  stock: number;
  minStock: number;
  unitName: string;
  suggestedQty?: number | undefined;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
  categoryName?: string | undefined;
  zoneName?: string | undefined;
}

export interface StockAlertSlipData {
  storeName?: string | undefined;
  alertItems: StockAlertSlipItem[];
  generatedAt?: string | undefined;
}

export interface GeneratedSlipResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Creates a high-DPI canvas-rendered Purchase Order PNG slip image
 */
export async function generatePurchaseOrderSlipImage(
  data: PurchaseOrderSlipData,
): Promise<GeneratedSlipResult> {
  const storeName = getSystemStoreName(data.storeName || DEFAULT_STORE_NAME);
  const items = data.items;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2d context for canvas");
  }

  const scale = 2; // Retina sharpness
  const width = 640;
  const padding = 28;
  const headerHeight = 150;
  const rowHeight = 36;
  const footerHeight = 170;
  const totalHeight = headerHeight + Math.max(1, items.length) * rowHeight + footerHeight;

  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  // Emerald brand header stripe
  ctx.fillStyle = "#059669";
  ctx.fillRect(0, 0, width, 8);

  // Top Title Banner
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(storeName, padding, 40);

  // Badge: ใบสั่งซื้อสินค้า (PURCHASE ORDER)
  ctx.fillStyle = "#ecfdf5";
  ctx.fillRect(width - padding - 165, 24, 165, 24);
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 1;
  ctx.strokeRect(width - padding - 165, 24, 165, 24);

  ctx.fillStyle = "#047857";
  ctx.font = "bold 11px 'Prompt', -apple-system, sans-serif";
  ctx.fillText("📦 ใบสั่งซื้อสินค้า (PO)", width - padding - 150, 40);

  // Meta Info
  ctx.fillStyle = "#475569";
  ctx.font = "12px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(`เลขที่: ${data.orderNumber}`, padding, 66);
  ctx.fillText(`วันที่สั่งซื้อ: ${data.createdAt}`, padding, 86);
  ctx.fillText(`ซัพพลายเออร์: ${data.supplierName || "ซัพพลายเออร์ทั่วไป"}`, padding, 106);

  // Divider
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 122);
  ctx.lineTo(width - padding, 122);
  ctx.stroke();

  // Table Column Header Bar
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(padding, 130, width - padding * 2, 28);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
  ctx.fillText("รายการสินค้า", padding + 8, 148);
  ctx.fillText("จำนวน", width - padding - 190, 148);
  ctx.fillText("ราคา/หน่วย", width - padding - 115, 148);
  ctx.fillText("ยอดรวม (฿)", width - padding - 45, 148);

  // Rows
  let currentY = 180;
  ctx.font = "12px 'Prompt', -apple-system, sans-serif";

  if (items.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 12px 'Prompt', -apple-system, sans-serif";
    ctx.fillText("(ไม่มีรายการสินค้า)", padding + 8, currentY);
    currentY += rowHeight;
  } else {
    items.forEach((item, idx) => {
      // Alternating background
      if (idx % 2 === 1) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(padding, currentY - 16, width - padding * 2, rowHeight);
      }

      ctx.fillStyle = "#0f172a";
      const maxNameLen = 26;
      const truncatedName =
        item.name.length > maxNameLen ? `${item.name.slice(0, maxNameLen - 2)}...` : item.name;
      ctx.fillText(`${idx + 1}. ${truncatedName}`, padding + 8, currentY);

      // Quantity & Unit
      ctx.fillStyle = "#059669";
      ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
      ctx.fillText(`${item.quantity} ${item.unitName}`, width - padding - 190, currentY);

      // Cost price
      ctx.fillStyle = "#64748b";
      ctx.font = "12px 'Prompt', -apple-system, sans-serif";
      const unitCost = item.costPrice ?? 0;
      ctx.fillText(`฿${unitCost.toFixed(0)}`, width - padding - 110, currentY);

      // Total
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
      const rowTotal = item.total ?? item.quantity * unitCost;
      ctx.fillText(`฿${rowTotal.toFixed(0)}`, width - padding - 45, currentY);

      currentY += rowHeight;
    });
  }

  // Bottom Border
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(padding, currentY + 6);
  ctx.lineTo(width - padding, currentY + 6);
  ctx.stroke();

  // Summary Totals Box
  currentY += 24;
  ctx.fillStyle = "#ecfdf5";
  ctx.fillRect(padding, currentY, width - padding * 2, 48);
  ctx.strokeStyle = "#a7f3d0";
  ctx.strokeRect(padding, currentY, width - padding * 2, 48);

  ctx.fillStyle = "#065f46";
  ctx.font = "bold 13px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(
    `รวมทั้งหมด: ${items.length} รายการ (${data.totalQuantity} ชิ้น)`,
    padding + 16,
    currentY + 30,
  );

  ctx.fillStyle = "#047857";
  ctx.font = "bold 16px 'Prompt', -apple-system, sans-serif";
  const costStr = `฿${data.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
  ctx.fillText(costStr, width - padding - 145, currentY + 30);

  // Footer Watermark & Barcode
  currentY += 72;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(
    `เอกสารสร้างอัตโนมัติจากระบบ ${storeName} • รองรับการส่งเข้า LINE ทันที`,
    padding,
    currentY,
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const resolvedBlob = blob || new Blob([], { type: "image/png" });
        const dataUrl = canvas.toDataURL("image/png");
        resolve({
          dataUrl,
          blob: resolvedBlob,
          width: canvas.width,
          height: canvas.height,
        });
      },
      "image/png",
      0.95,
    );
  });
}

/**
 * Creates a high-DPI canvas-rendered Stock Alert PNG slip image
 */
export async function generateStockAlertSlipImage(
  data: StockAlertSlipData,
): Promise<GeneratedSlipResult> {
  const storeName = getSystemStoreName(data.storeName || DEFAULT_STORE_NAME);
  const items = data.alertItems;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2d context for canvas");
  }

  const scale = 2;
  const width = 640;
  const padding = 28;
  const headerHeight = 145;
  const rowHeight = 36;
  const footerHeight = 150;
  const totalHeight = headerHeight + Math.max(1, items.length) * rowHeight + footerHeight;

  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  // Amber/Rose brand stripe
  ctx.fillStyle = "#f43f5e";
  ctx.fillRect(0, 0, width, 8);

  // Title
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(storeName, padding, 40);

  // Badge: แจ้งเตือนสต็อกสินค้า
  ctx.fillStyle = "#fff1f2";
  ctx.fillRect(width - padding - 180, 24, 180, 24);
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 1;
  ctx.strokeRect(width - padding - 180, 24, 180, 24);

  ctx.fillStyle = "#be123c";
  ctx.font = "bold 11px 'Prompt', -apple-system, sans-serif";
  ctx.fillText("⚠️ แจ้งเตือนสินค้าต้องสั่งซื้อ", width - padding - 165, 40);

  // Subtitle
  const dateStr =
    data.generatedAt ||
    `${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")}`;
  ctx.fillStyle = "#64748b";
  ctx.font = "12px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(`รายงานสินค้าต่ำกว่าจุดสั่งซื้อขั้นต่ำ • ออกเมื่อ: ${dateStr}`, padding, 66);

  const outOfStockCount = items.filter((i) => i.status === "OUT_OF_STOCK").length;
  const lowStockCount = items.filter((i) => i.status === "LOW_STOCK").length;

  ctx.fillStyle = "#e11d48";
  ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(`สินค้าหมดสต็อก: ${outOfStockCount} รายการ`, padding, 88);

  ctx.fillStyle = "#d97706";
  ctx.fillText(`สินค้าใกล้หมด: ${lowStockCount} รายการ`, padding + 180, 88);

  // Divider
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 110);
  ctx.lineTo(width - padding, 110);
  ctx.stroke();

  // Column header
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(padding, 118, width - padding * 2, 28);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
  ctx.fillText("รายการสินค้า", padding + 8, 136);
  ctx.fillText("คงเหลือ", width - padding - 180, 136);
  ctx.fillText("จุดเตือนขั้นต่ำ", width - padding - 100, 136);
  ctx.fillText("สถานะ", width - padding - 35, 136);

  let currentY = 168;
  ctx.font = "12px 'Prompt', -apple-system, sans-serif";

  if (items.length === 0) {
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 13px 'Prompt', -apple-system, sans-serif";
    ctx.fillText("✅ สต็อกสินค้าทุกรายการอยู่ในระดับปลอดภัย", padding + 8, currentY);
    currentY += rowHeight;
  } else {
    items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(padding, currentY - 16, width - padding * 2, rowHeight);
      }

      ctx.fillStyle = "#0f172a";
      const maxNameLen = 28;
      const truncatedName =
        item.name.length > maxNameLen ? `${item.name.slice(0, maxNameLen - 2)}...` : item.name;
      ctx.fillText(`${idx + 1}. ${truncatedName}`, padding + 8, currentY);

      // Stock
      ctx.fillStyle = item.stock <= 0 ? "#e11d48" : "#d97706";
      ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
      ctx.fillText(`${item.stock} ${item.unitName}`, width - padding - 180, currentY);

      // Min stock
      ctx.fillStyle = "#64748b";
      ctx.font = "12px 'Prompt', -apple-system, sans-serif";
      ctx.fillText(`${item.minStock} ${item.unitName}`, width - padding - 100, currentY);

      // Status pill
      ctx.fillStyle = item.status === "OUT_OF_STOCK" ? "#be123c" : "#b45309";
      ctx.font = "bold 11px 'Prompt', -apple-system, sans-serif";
      ctx.fillText(
        item.status === "OUT_OF_STOCK" ? "หมด (0)" : "ใกล้หมด",
        width - padding - 40,
        currentY,
      );

      currentY += rowHeight;
    });
  }

  // Bottom Border
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(padding, currentY + 6);
  ctx.lineTo(width - padding, currentY + 6);
  ctx.stroke();

  // Summary box
  currentY += 24;
  ctx.fillStyle = "#fff1f2";
  ctx.fillRect(padding, currentY, width - padding * 2, 44);
  ctx.strokeStyle = "#fecdd3";
  ctx.strokeRect(padding, currentY, width - padding * 2, 44);

  ctx.fillStyle = "#9f1239";
  ctx.font = "bold 13px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(`รวมสินค้าที่ต้องสั่งซื้อด่วน: ${items.length} รายการ`, padding + 16, currentY + 27);

  // Footer Watermark
  currentY += 66;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px 'Prompt', -apple-system, sans-serif";
  ctx.fillText(
    `รายงานสต็อกสร้างอัตโนมัติจาก ${storeName} • ส่งเข้าแชท LINE กลุ่มจัดซื้อได้ทันที`,
    padding,
    currentY,
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const resolvedBlob = blob || new Blob([], { type: "image/png" });
        const dataUrl = canvas.toDataURL("image/png");
        resolve({
          dataUrl,
          blob: resolvedBlob,
          width: canvas.width,
          height: canvas.height,
        });
      },
      "image/png",
      0.95,
    );
  });
}

/**
 * Uploads generated slip image base64 data to central server endpoint (/api/line-image/upload)
 * to obtain a publicly accessible HTTPS URL for LINE Messaging API & LIFF SDK.
 */
export async function uploadSlipImageToServer(
  imageBase64: string,
  preferredId?: string,
): Promise<{ success: boolean; imageId: string; imageUrl: string; error?: string }> {
  try {
    const res = await fetch("/api/line-image/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, ...(preferredId ? { id: preferredId } : {}) }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        imageId: "",
        imageUrl: "",
        error: `อัปโหลดรูปภาพไม่สำเร็จ (HTTP ${res.status}): ${errText}`,
      };
    }

    const data = (await res.json()) as { success: boolean; imageId: string; imageUrl: string };
    return data;
  } catch (err: unknown) {
    return {
      success: false,
      imageId: "",
      imageUrl: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Copies a PNG blob into the clipboard for immediate paste into LINE or messaging apps
 */
export async function copyImageBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    return false;
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers browser download of a PNG image blob
 */
export function downloadImageBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Native Share via Web Share API if supported on mobile devices
 */
export async function shareImageFileViaNavigator(
  blob: Blob,
  filename: string,
  title: string,
  text: string,
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.canShare) {
    return false;
  }

  try {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
