/**
 * Slip Image Generator for LINE & Export
 * Generates crystal-clear, high-DPI PNG slips for Purchase Orders and Stock Alerts
 * that can be sent directly to LINE via Messaging API, LIFF shareTargetPicker, or Web Share.
 * Supports:
 * 1. "full_bleed_rich": Standard LINE Rich Message (1040px) edge-to-edge full-bleed graphic poster
 *    with radiant gradient, store badge, corner ribbon, dual comparison cards, highlight pill,
 *    and bottom navy action bar with the bright orange "คลิก" button (matching ttb sample style).
 * 2. "receipt": Standard tabular receipt slip.
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./flex-templates";

export type SlipDesignStyle = "full_bleed_rich" | "receipt";

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
  style?: SlipDesignStyle | undefined;
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
  style?: SlipDesignStyle | undefined;
}

export interface GeneratedSlipResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Robust cross-browser rounded rectangle path builder
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number],
  fill?: string,
  stroke?: string,
  lineWidth: number = 1,
) {
  let rTopLeft = 0;
  let rTopRight = 0;
  let rBottomRight = 0;
  let rBottomLeft = 0;

  if (typeof radius === "number") {
    rTopLeft = radius;
    rTopRight = radius;
    rBottomRight = radius;
    rBottomLeft = radius;
  } else if (Array.isArray(radius) && radius.length === 4) {
    [rTopLeft, rTopRight, rBottomRight, rBottomLeft] = radius;
  }

  ctx.beginPath();
  ctx.moveTo(x + rTopLeft, y);
  ctx.lineTo(x + w - rTopRight, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTopRight);
  ctx.lineTo(x + w, y + h - rBottomRight);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBottomRight, y + h);
  ctx.lineTo(x + rBottomLeft, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBottomLeft);
  ctx.lineTo(x, y + rTopLeft);
  ctx.quadraticCurveTo(x, y, x + rTopLeft, y);
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draws the corner black mourning / commemorative ribbon fold in top-left
 */
function drawCornerRibbon(ctx: CanvasRenderingContext2D, size: number = 100) {
  ctx.save();
  // Diagonal black ribbon tag
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fillStyle = "#09090b";
  ctx.fill();

  // White ribbon loop icon
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size * 0.35, size * 0.35, 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.35 - 7, size * 0.35 + 8);
  ctx.lineTo(size * 0.35 + 10, size * 0.35 + 24);
  ctx.moveTo(size * 0.35 + 7, size * 0.35 + 8);
  ctx.lineTo(size * 0.35 - 10, size * 0.35 + 24);
  ctx.stroke();

  ctx.restore();
}

/**
 * Creates Full-Bleed Edge-to-Edge Rich Banner PNG for Purchase Orders (Matching sample image style)
 * Dimensions: 1040 x H px (Official LINE Rich Message 1040px width)
 */
export async function generateFullBleedRichCardSlipImage(
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
  const width = 1040;
  const padding = 44;

  const headerHeight = 350;
  const statBoxHeight = 185;
  const pillHeight = 72;
  const maxTableItems = Math.min(items.length, 12);
  const rowHeight = 72;
  const tableHeaderHeight = 52;
  const tableRowsHeight = Math.max(1, maxTableItems) * rowHeight;
  const hasMoreItems = items.length > maxTableItems;
  const moreBannerHeight = hasMoreItems ? 46 : 0;
  const disclaimerHeight = 56;
  const bottomBarHeight = 124;

  const cardContentHeight =
    statBoxHeight +
    pillHeight +
    tableHeaderHeight +
    tableRowsHeight +
    moreBannerHeight +
    disclaimerHeight +
    48;

  const totalHeight = headerHeight + cardContentHeight + bottomBarHeight + 30;

  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  ctx.scale(scale, scale);

  // 1. Full-Bleed Radiant Orange Gradient Header (like sample image)
  const headerGrad = ctx.createLinearGradient(0, 0, width, headerHeight + 100);
  headerGrad.addColorStop(0, "#ff6e00");
  headerGrad.addColorStop(0.3, "#f97316");
  headerGrad.addColorStop(0.7, "#ea580c");
  headerGrad.addColorStop(1, "#c2410c");

  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, headerHeight + 120);

  // Background subtle glowing circles
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(width - 150, 140, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(180, 80, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Corner Ribbon (Top-Left)
  drawCornerRibbon(ctx, 100);

  // 3. Store Brand Pill/Badge (Top-Right)
  const storeBadgeWidth = Math.min(380, Math.max(260, storeName.length * 18 + 80));
  const storeBadgeX = width - padding - storeBadgeWidth;
  drawRoundedRect(ctx, storeBadgeX, 28, storeBadgeWidth, 70, 22, "#ffffff", "rgba(0,0,0,0.06)", 1);

  ctx.fillStyle = "#0284c7";
  ctx.font = "bold 28px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`🏪 ${storeName}`, storeBadgeX + storeBadgeWidth / 2, 72);
  ctx.textAlign = "left";

  // 4. Headline Thai Typography (Hero Section - Flex Message Size)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 54px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("สั่งดี สั่งไว ที่นี่ให้ครบ...", padding, 124);
  ctx.restore();

  // 3D Subhead Pill Badge (e.g. สินเชื่อคนผ่อนดี -> ใบสั่งซื้อสินค้าด่วน)
  drawRoundedRect(ctx, padding, 146, 480, 58, 18, "#0284c7", "#38bdf8", 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("📦 ใบสั่งซื้อสินค้าด่วน (PO)", padding + 24, 186);

  // Subtitle accent text
  ctx.fillStyle = "#fff7ed";
  ctx.font = "bold 32px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("จัดซื้อสะดวก เช็กสต็อกทันใจ!", padding, 244);

  ctx.fillStyle = "#ffedd5";
  ctx.font = "bold 22px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(
    `เลขที่: ${data.orderNumber} • วันที่: ${data.createdAt} • ${data.supplierName || "ซัพพลายเออร์ทั่วไป"}`,
    padding,
    282,
  );

  // 5. Decorative Mascot / Shopping Cart Graphic on the right side of header
  ctx.save();
  const mascotX = width - 180;
  const mascotY = 205;
  // Outer glowing circle
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.arc(mascotX, mascotY, 82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(mascotX, mascotY, 68, 0, Math.PI * 2);
  ctx.fill();

  // Icon symbol inside
  ctx.font = "64px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🛒", mascotX, mascotY + 22);
  ctx.restore();

  // 6. Center White Container Card (With soft drop shadow)
  const cardY = 320;
  const cardWidth = width - padding * 2;
  const cardInnerX = padding;

  // Fill outer canvas below header with soft off-white/light-slate
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, cardY + 50, width, totalHeight - cardY - 50);

  // Draw Card Background
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(
    ctx,
    cardInnerX,
    cardY,
    cardWidth,
    cardContentHeight,
    28,
    "#ffffff",
    "#e2e8f0",
    1,
  );
  ctx.restore();

  // 7. Dual Comparison Cards (Like the 2 columns in the sample image)
  const colY = cardY + 28;
  const colWidth = (cardWidth - 56) / 2;
  const colHeight = 145;

  // Left Column (Items Count - Big Bold Flex Message Size)
  const leftX = cardInnerX + 20;
  drawRoundedRect(ctx, leftX, colY, colWidth, colHeight, 20, "#f8fafc", "#e2e8f0", 1.5);
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 22px 'Prompt', sans-serif";
  ctx.fillText("📋 รายการสั่งซื้อทั้งหมด", leftX + 24, colY + 38);

  ctx.fillStyle = "#0284c7";
  ctx.font = "bold 64px 'Prompt', sans-serif";
  ctx.fillText(`${items.length}`, leftX + 24, colY + 102);

  ctx.fillStyle = "#475569";
  ctx.font = "bold 28px 'Prompt', sans-serif";
  ctx.fillText("รายการ", leftX + 125 + (items.length > 9 ? 35 : 0), colY + 102);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 20px 'Prompt', sans-serif";
  ctx.fillText(`รวมทั้งหมด ${data.totalQuantity} หน่วยนับ`, leftX + 24, colY + 132);

  // Right Column (Highlighted Total Value - Big Bold Flex Message Size)
  const rightX = leftX + colWidth + 16;
  drawRoundedRect(ctx, rightX, colY, colWidth, colHeight, 20, "#eff6ff", "#60a5fa", 2);
  ctx.fillStyle = "#1d4ed8";
  ctx.font = "bold 22px 'Prompt', sans-serif";
  ctx.fillText("💰 ประมาณการยอดสั่งซื้อ", rightX + 24, colY + 38);

  ctx.fillStyle = "#047857";
  ctx.font = "bold 60px 'Prompt', sans-serif";
  const costShort = `฿${Math.round(data.totalCost).toLocaleString("th-TH")}`;
  ctx.fillText(costShort, rightX + 24, colY + 102);

  ctx.fillStyle = "#059669";
  ctx.font = "bold 20px 'Prompt', sans-serif";
  ctx.fillText("คำนวณจากราคาทุนล่าสุด", rightX + 24, colY + 132);

  // 8. Floating Center Highlight Pill Badge (Like "ประหยัด 630 บาท/เดือน" in sample)
  const pillY = colY + colHeight + 20;
  const pillW = Math.min(cardWidth - 60, 760);
  const pillX = cardInnerX + (cardWidth - pillW) / 2;

  drawRoundedRect(ctx, pillX, pillY, pillW, 64, 32, "#0284c7", "#38bdf8", 1.5);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  const pillText = `⚡ ยอดสุทธิ ฿${data.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} • สั่งซื้อพร้อมตรวจรับ`;
  ctx.fillText(pillText, pillX + pillW / 2, pillY + 42);
  ctx.textAlign = "left";

  // 9. Table List Section (Large Flex Message Typography)
  let tableY = pillY + 88;

  // Table header bar
  drawRoundedRect(ctx, cardInnerX + 20, tableY, cardWidth - 40, 48, 14, "#f1f5f9", "#e2e8f0", 1);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 24px 'Prompt', sans-serif";
  ctx.fillText("รายการสินค้า (ชื่อ & หมวด)", cardInnerX + 36, tableY + 33);
  ctx.fillText("จำนวน", cardInnerX + cardWidth - 380, tableY + 33);
  ctx.fillText("หน่วยนับ", cardInnerX + cardWidth - 250, tableY + 33);
  ctx.fillText("รวม (฿)", cardInnerX + cardWidth - 120, tableY + 33);

  tableY += 60;

  if (items.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 24px 'Prompt', sans-serif";
    ctx.fillText("(ไม่มีรายการสินค้าในใบสั่งซื้อ)", cardInnerX + 36, tableY + 32);
    tableY += rowHeight;
  } else {
    for (let i = 0; i < maxTableItems; i++) {
      const item = items[i];
      if (!item) break;

      // Alternating background
      if (i % 2 === 1) {
        drawRoundedRect(
          ctx,
          cardInnerX + 20,
          tableY - 14,
          cardWidth - 40,
          rowHeight - 6,
          10,
          "#f8fafc",
        );
      }

      // 1. Item Name - Large Bold Flex Message Size
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 30px 'Prompt', sans-serif";
      const maxLen = 28;
      const nameText =
        item.name.length > maxLen ? `${item.name.slice(0, maxLen - 2)}...` : item.name;
      ctx.fillText(`${i + 1}. ${nameText}`, cardInnerX + 36, tableY + 24);

      // Subtitle if category exists
      if (item.categoryName || item.zoneName) {
        ctx.fillStyle = "#64748b";
        ctx.font = "20px 'Prompt', sans-serif";
        const meta = [item.categoryName, item.zoneName].filter(Boolean).join(" • ");
        ctx.fillText(meta, cardInnerX + 68, tableY + 48);
      }

      // 2. Quantity - Large Bold Green Flex Message Typography
      ctx.fillStyle = "#059669";
      ctx.font = "bold 38px 'Prompt', sans-serif";
      ctx.fillText(`${item.quantity}`, cardInnerX + cardWidth - 380, tableY + 28);

      // 3. Unit Name - Clear Large Flex Message Typography
      ctx.fillStyle = "#475569";
      ctx.font = "bold 28px 'Prompt', sans-serif";
      ctx.fillText(`${item.unitName}`, cardInnerX + cardWidth - 250, tableY + 28);

      // 4. Total Amount
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 30px 'Prompt', sans-serif";
      const rowTotal = item.total ?? item.quantity * (item.costPrice ?? 0);
      ctx.fillText(`฿${rowTotal.toFixed(0)}`, cardInnerX + cardWidth - 120, tableY + 28);

      tableY += rowHeight;
    }

    if (hasMoreItems) {
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 22px 'Prompt', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `... และมีสินค้าอีก ${items.length - maxTableItems} รายการ (เปิดดูเต็มได้ในระบบ)`,
        cardInnerX + cardWidth / 2,
        tableY + 16,
      );
      ctx.textAlign = "left";
      tableY += 40;
    }
  }

  // 10. Footnote / Disclaimer
  ctx.fillStyle = "#64748b";
  ctx.font = "18px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `สมมติฐานการคำนวณและข้อมูลสินค้าประมวลผลอัตโนมัติจากระบบสต็อกร้าน • ออกเอกสาร ณ ${data.createdAt}`,
    cardInnerX + cardWidth / 2,
    tableY + 28,
  );
  ctx.textAlign = "left";

  // 11. Full-Bleed Dark Navy Action Bar at Bottom (Exact replicate of sample image!)
  const bottomY = totalHeight - bottomBarHeight;

  // Navy blue background
  ctx.fillStyle = "#041633";
  ctx.fillRect(0, bottomY, width, bottomBarHeight);

  // Left Disclaimer & Notice Text (Large Legible Typography)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Prompt', sans-serif";
  ctx.fillText("ตรวจสอบรายการสินค้าและดำเนินการตรวจรับเข้าคลังได้ทันที", padding, bottomY + 50);

  ctx.fillStyle = "#93c5fd";
  ctx.font = "18px 'Prompt', sans-serif";
  ctx.fillText(`ระบบจัดซื้อและบริหารสต็อก MiniMark • ${storeName}`, padding, bottomY + 84);

  // Right Vibrant Orange "คลิก" Button (like in the sample image)
  const btnWidth = 190;
  const btnHeight = 66;
  const btnX = width - padding - btnWidth;
  const btnY = bottomY + 28;

  // 3D Button Gradient
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
  btnGrad.addColorStop(0, "#fb923c");
  btnGrad.addColorStop(0.2, "#f97316");
  btnGrad.addColorStop(1, "#ea580c");

  drawRoundedRect(ctx, btnX, btnY, btnWidth, btnHeight, 33, btnGrad, "#fed7aa", 2);

  // Button text
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 32px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("คลิก", btnX + btnWidth / 2, btnY + 45);
  ctx.textAlign = "left";

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
      0.96,
    );
  });
}

/**
 * Creates Full-Bleed Edge-to-Edge Rich Banner PNG for Stock Alerts (Sample image style)
 * Dimensions: 1040 x H px (Official LINE Rich Message width)
 */
export async function generateStockAlertFullBleedRichCardImage(
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
  const width = 1040;
  const padding = 44;

  const headerHeight = 350;
  const statBoxHeight = 185;
  const pillHeight = 72;
  const maxTableItems = Math.min(items.length, 12);
  const rowHeight = 72;
  const tableHeaderHeight = 52;
  const tableRowsHeight = Math.max(1, maxTableItems) * rowHeight;
  const hasMoreItems = items.length > maxTableItems;
  const moreBannerHeight = hasMoreItems ? 46 : 0;
  const disclaimerHeight = 56;
  const bottomBarHeight = 124;

  const outOfStockCount = items.filter((i) => i.status === "OUT_OF_STOCK").length;
  const lowStockCount = items.filter((i) => i.status === "LOW_STOCK").length;

  const cardContentHeight =
    statBoxHeight +
    pillHeight +
    tableHeaderHeight +
    tableRowsHeight +
    moreBannerHeight +
    disclaimerHeight +
    48;

  const totalHeight = headerHeight + cardContentHeight + bottomBarHeight + 30;

  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  ctx.scale(scale, scale);

  // 1. Full-Bleed Radiant Crimson/Amber Gradient Header
  const headerGrad = ctx.createLinearGradient(0, 0, width, headerHeight + 100);
  headerGrad.addColorStop(0, "#e11d48");
  headerGrad.addColorStop(0.4, "#f43f5e");
  headerGrad.addColorStop(1, "#fb7185");

  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, headerHeight + 120);

  // Background subtle glowing circles
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(width - 150, 140, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Corner Ribbon
  drawCornerRibbon(ctx, 100);

  // 3. Store Brand Badge
  const storeBadgeWidth = Math.min(340, Math.max(240, storeName.length * 16 + 70));
  const storeBadgeX = width - padding - storeBadgeWidth;
  drawRoundedRect(ctx, storeBadgeX, 30, storeBadgeWidth, 64, 20, "#ffffff", "rgba(0,0,0,0.06)", 1);

  ctx.fillStyle = "#be123c";
  ctx.font = "bold 24px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`🏪 ${storeName}`, storeBadgeX + storeBadgeWidth / 2, 70);
  ctx.textAlign = "left";

  // 4. Headline (Flex Message Large Size)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 48px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("เตือนด่วน สต็อกต่ำกว่าเกณฑ์...", padding, 122);
  ctx.restore();

  // Badge Pill
  drawRoundedRect(ctx, padding, 148, 440, 54, 16, "#9f1239", "#fda4af", 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("⚠️ แจ้งเตือนสินค้าต้องสั่งซื้อ", padding + 22, 185);

  ctx.fillStyle = "#fff1f2";
  ctx.font = "bold 28px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("สินค้าหมดและใกล้หมดจุดสั่งซื้อขั้นต่ำ", padding, 242);

  const dateStr =
    data.generatedAt ||
    `${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")}`;
  ctx.fillStyle = "#ffe4e6";
  ctx.font = "20px 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`อัปเดตสถานะล่าสุด: ${dateStr}`, padding, 280);

  // Right warning circle graphic
  ctx.save();
  const mascotX = width - 180;
  const mascotY = 205;
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.arc(mascotX, mascotY, 82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(mascotX, mascotY, 68, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "64px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚠️", mascotX, mascotY + 22);
  ctx.restore();

  // 5. Center Container Card
  const cardY = 320;
  const cardWidth = width - padding * 2;
  const cardInnerX = padding;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, cardY + 50, width, totalHeight - cardY - 50);

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(
    ctx,
    cardInnerX,
    cardY,
    cardWidth,
    cardContentHeight,
    28,
    "#ffffff",
    "#e2e8f0",
    1,
  );
  ctx.restore();

  // 6. Dual Comparison Cards (Out of Stock vs Low Stock - Big Bold Typography)
  const colY = cardY + 28;
  const colWidth = (cardWidth - 56) / 2;
  const colHeight = 145;

  // Left Column (Out of stock)
  const leftX = cardInnerX + 20;
  drawRoundedRect(ctx, leftX, colY, colWidth, colHeight, 20, "#fff1f2", "#fecdd3", 2);
  ctx.fillStyle = "#be123c";
  ctx.font = "bold 22px 'Prompt', sans-serif";
  ctx.fillText("🚨 สินค้าหมดสต็อก (เหลือ 0)", leftX + 24, colY + 38);

  ctx.fillStyle = "#e11d48";
  ctx.font = "bold 64px 'Prompt', sans-serif";
  ctx.fillText(`${outOfStockCount}`, leftX + 24, colY + 102);

  ctx.fillStyle = "#9f1239";
  ctx.font = "bold 28px 'Prompt', sans-serif";
  ctx.fillText("รายการ", leftX + 125 + (outOfStockCount > 9 ? 35 : 0), colY + 102);

  ctx.fillStyle = "#be123c";
  ctx.font = "bold 20px 'Prompt', sans-serif";
  ctx.fillText("ต้องเติมทันที ลูกค้าถามหา", leftX + 24, colY + 132);

  // Right Column (Low stock)
  const rightX = leftX + colWidth + 16;
  drawRoundedRect(ctx, rightX, colY, colWidth, colHeight, 20, "#fffbeb", "#fde68a", 2);
  ctx.fillStyle = "#b45309";
  ctx.font = "bold 22px 'Prompt', sans-serif";
  ctx.fillText("⚠️ สินค้าใกล้หมดสต็อก", rightX + 24, colY + 38);

  ctx.fillStyle = "#d97706";
  ctx.font = "bold 64px 'Prompt', sans-serif";
  ctx.fillText(`${lowStockCount}`, rightX + 24, colY + 102);

  ctx.fillStyle = "#b45309";
  ctx.font = "bold 28px 'Prompt', sans-serif";
  ctx.fillText("รายการ", rightX + 125 + (lowStockCount > 9 ? 35 : 0), colY + 102);

  ctx.fillStyle = "#d97706";
  ctx.font = "bold 20px 'Prompt', sans-serif";
  ctx.fillText("ต่ำกว่าจุดเตือนขั้นต่ำ", rightX + 24, colY + 132);

  // 7. Highlight Pill
  const pillY = colY + colHeight + 20;
  const pillW = Math.min(cardWidth - 60, 760);
  const pillX = cardInnerX + (cardWidth - pillW) / 2;

  drawRoundedRect(ctx, pillX, pillY, pillW, 64, 32, "#be123c", "#fb7185", 1.5);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `⚡ รวมสินค้าต้องสั่งด่วน: ${items.length} รายการ • จัดทำใบสั่งซื้อได้ทันที`,
    pillX + pillW / 2,
    pillY + 42,
  );
  ctx.textAlign = "left";

  // 8. Table List Section (Large Flex Message Typography)
  let tableY = pillY + 88;
  drawRoundedRect(ctx, cardInnerX + 20, tableY, cardWidth - 40, 48, 14, "#f1f5f9", "#e2e8f0", 1);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 24px 'Prompt', sans-serif";
  ctx.fillText("รายการสินค้า (ชื่อ & หมวด)", cardInnerX + 36, tableY + 33);
  ctx.fillText("คงเหลือ", cardInnerX + cardWidth - 380, tableY + 33);
  ctx.fillText("จุดสั่งซื้อ", cardInnerX + cardWidth - 250, tableY + 33);
  ctx.fillText("สถานะ", cardInnerX + cardWidth - 120, tableY + 33);

  tableY += 60;

  if (items.length === 0) {
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 24px 'Prompt', sans-serif";
    ctx.fillText("✅ สต็อกสินค้าทุกรายการอยู่ในระดับปลอดภัย", cardInnerX + 36, tableY + 32);
    tableY += rowHeight;
  } else {
    for (let i = 0; i < maxTableItems; i++) {
      const item = items[i];
      if (!item) break;

      if (i % 2 === 1) {
        drawRoundedRect(
          ctx,
          cardInnerX + 20,
          tableY - 14,
          cardWidth - 40,
          rowHeight - 6,
          10,
          "#f8fafc",
        );
      }

      // 1. Item Name - Large Bold Flex Message Size
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 30px 'Prompt', sans-serif";
      const maxLen = 28;
      const nameText =
        item.name.length > maxLen ? `${item.name.slice(0, maxLen - 2)}...` : item.name;
      ctx.fillText(`${i + 1}. ${nameText}`, cardInnerX + 36, tableY + 24);

      // Subtitle if category or zone
      if (item.categoryName || item.zoneName) {
        ctx.fillStyle = "#64748b";
        ctx.font = "20px 'Prompt', sans-serif";
        const meta = [item.categoryName, item.zoneName].filter(Boolean).join(" • ");
        ctx.fillText(meta, cardInnerX + 68, tableY + 48);
      }

      // 2. Remaining stock - Big bold red/amber
      ctx.fillStyle = item.stock <= 0 ? "#e11d48" : "#d97706";
      ctx.font = "bold 38px 'Prompt', sans-serif";
      ctx.fillText(`${item.stock} ${item.unitName}`, cardInnerX + cardWidth - 380, tableY + 28);

      // 3. Min stock
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 28px 'Prompt', sans-serif";
      ctx.fillText(`${item.minStock} ${item.unitName}`, cardInnerX + cardWidth - 250, tableY + 28);

      // 4. Status pill
      ctx.fillStyle = item.status === "OUT_OF_STOCK" ? "#be123c" : "#b45309";
      ctx.font = "bold 28px 'Prompt', sans-serif";
      ctx.fillText(
        item.status === "OUT_OF_STOCK" ? "หมด (0)" : "ใกล้หมด",
        cardInnerX + cardWidth - 120,
        tableY + 28,
      );

      tableY += rowHeight;
    }

    if (hasMoreItems) {
      ctx.fillStyle = "#be123c";
      ctx.font = "bold 22px 'Prompt', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `... และมีสินค้าอีก ${items.length - maxTableItems} รายการ (เปิดดูเต็มได้ในระบบ)`,
        cardInnerX + cardWidth / 2,
        tableY + 16,
      );
      ctx.textAlign = "left";
      tableY += 40;
    }
  }

  // 9. Footnote
  ctx.fillStyle = "#64748b";
  ctx.font = "18px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `รายงานสต็อกสร้างอัตโนมัติจาก ${storeName} • ส่งเข้าแชท LINE กลุ่มจัดซื้อได้ทันที`,
    cardInnerX + cardWidth / 2,
    tableY + 28,
  );
  ctx.textAlign = "left";

  // 10. Bottom Action Bar (Large Legible Typography)
  const bottomY = totalHeight - bottomBarHeight;
  ctx.fillStyle = "#041633";
  ctx.fillRect(0, bottomY, width, bottomBarHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Prompt', sans-serif";
  ctx.fillText("เปิดหน้ารายการสั่งซื้อเพื่อเติมสินค้าเข้าคลังทันที", padding, bottomY + 50);

  ctx.fillStyle = "#93c5fd";
  ctx.font = "18px 'Prompt', sans-serif";
  ctx.fillText(`ระบบจัดซื้อและบริหารสต็อก MiniMark • ${storeName}`, padding, bottomY + 84);

  const btnWidth = 190;
  const btnHeight = 66;
  const btnX = width - padding - btnWidth;
  const btnY = bottomY + 28;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
  btnGrad.addColorStop(0, "#fb923c");
  btnGrad.addColorStop(0.2, "#f97316");
  btnGrad.addColorStop(1, "#ea580c");

  drawRoundedRect(ctx, btnX, btnY, btnWidth, btnHeight, 33, btnGrad, "#fed7aa", 2);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 32px 'Prompt', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("คลิก", btnX + btnWidth / 2, btnY + 45);
  ctx.textAlign = "left";
  ctx.textAlign = "left";

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
      0.96,
    );
  });
}

/**
 * Creates tabular receipt image (receipt style)
 */
export async function generatePurchaseOrderReceiptImage(
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
      if (idx % 2 === 1) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(padding, currentY - 16, width - padding * 2, rowHeight);
      }

      ctx.fillStyle = "#0f172a";
      const maxNameLen = 26;
      const truncatedName =
        item.name.length > maxNameLen ? `${item.name.slice(0, maxNameLen - 2)}...` : item.name;
      ctx.fillText(`${idx + 1}. ${truncatedName}`, padding + 8, currentY);

      ctx.fillStyle = "#059669";
      ctx.font = "bold 12px 'Prompt', -apple-system, sans-serif";
      ctx.fillText(`${item.quantity} ${item.unitName}`, width - padding - 190, currentY);

      ctx.fillStyle = "#64748b";
      ctx.font = "12px 'Prompt', -apple-system, sans-serif";
      const unitCost = item.costPrice ?? 0;
      ctx.fillText(`฿${unitCost.toFixed(0)}`, width - padding - 110, currentY);

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
 * Primary Purchase Order Slip Generator (Defaults to Full Bleed Rich Banner)
 */
export async function generatePurchaseOrderSlipImage(
  data: PurchaseOrderSlipData,
  style: SlipDesignStyle = "full_bleed_rich",
): Promise<GeneratedSlipResult> {
  const chosenStyle = data.style || style;
  if (chosenStyle === "receipt") {
    return generatePurchaseOrderReceiptImage(data);
  }
  return generateFullBleedRichCardSlipImage(data);
}

/**
 * Primary Stock Alert Slip Generator (Defaults to Full Bleed Rich Banner)
 */
export async function generateStockAlertSlipImage(
  data: StockAlertSlipData,
  style: SlipDesignStyle = "full_bleed_rich",
): Promise<GeneratedSlipResult> {
  const chosenStyle = data.style || style;
  if (chosenStyle === "receipt") {
    // Basic receipt fallback
    return generateStockAlertFullBleedRichCardImage(data);
  }
  return generateStockAlertFullBleedRichCardImage(data);
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
