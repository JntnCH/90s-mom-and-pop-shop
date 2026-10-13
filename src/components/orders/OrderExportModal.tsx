import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileCode,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Printer,
  Share2,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  createNewSpreadsheet,
  getGoogleAccessToken,
  signInWithGoogle,
} from "@/lib/google-sheets-service";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ExportOrderItem {
  productName: string;
  barcode: string;
  categoryName: string;
  zoneName: string;
  quantity: number;
  unitName: string;
  costPrice: number;
  total: number;
  note?: string;
}

export interface ExportOrderPayload {
  orderNumber: string;
  createdAt: string;
  storeName: string;
  supplierName: string;
  items: ExportOrderItem[];
  totalQuantity: number;
  totalCost: number;
  note?: string;
}

interface OrderExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ExportOrderPayload | null;
}

export function OrderExportModal({ open, onOpenChange, payload }: OrderExportModalProps) {
  const [activeTab, setActiveTab] = useState<"pdf" | "excel" | "image" | "text" | "json">("pdf");
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const printDocRef = useRef<HTMLDivElement>(null);
  const [isExportingGoogleSheets, setIsExportingGoogleSheets] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string | null>(null);

  if (!payload) return null;

  const handleExportGoogleSheets = async () => {
    setIsExportingGoogleSheets(true);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        toast.info("กรุณาเข้าสู่ระบบ Google เพื่อบันทึกลงในสเปรดชีต");
        const res = await signInWithGoogle();
        token = res.accessToken;
      }

      const rows: (string | number)[][] = [
        [
          `ใบสั่งซื้อสินค้าเลขที่: ${payload.orderNumber}`,
          `ร้านค้า: ${payload.storeName}`,
          `วันที่: ${payload.createdAt}`,
        ],
        [
          `ซัพพลายเออร์: ${payload.supplierName || "-"}`,
          `ยอดรวมสุทธิ: ฿${payload.totalCost.toFixed(2)}`,
        ],
        [],
        [
          "ลำดับ",
          "บาร์โค้ด",
          "ชื่อสินค้า",
          "โซนจัดเก็บ",
          "หมวดหมู่",
          "จำนวน",
          "หน่วยนับ",
          "ราคาต่อหน่วย (บาท)",
          "ราคารวม (บาท)",
          "หมายเหตุ",
        ],
        ...payload.items.map((it, idx) => [
          idx + 1,
          it.barcode,
          it.productName,
          it.zoneName,
          it.categoryName,
          it.quantity,
          it.unitName,
          it.costPrice,
          it.total,
          it.note || "",
        ]),
        [],
        [
          "",
          "",
          "ยอดรวมทั้งสิ้น",
          "",
          "",
          payload.totalQuantity,
          "ชิ้น",
          "",
          payload.totalCost,
          "",
        ],
      ];

      const created = await createNewSpreadsheet(
        `ใบสั่งซื้อ ${payload.orderNumber} - ${payload.storeName}`,
        "ใบสั่งซื้อ",
        rows,
        token,
      );

      setGoogleSheetsUrl(created.spreadsheetUrl);
      toast.success("สร้างเอกสารใน Google Sheets สำเร็จเรียบร้อย!");
    } catch (err: unknown) {
      console.error("Export PO to sheets error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("ไม่สามารถสร้าง Google Sheet ได้: " + msg);
    } finally {
      setIsExportingGoogleSheets(false);
    }
  };

  // 1. Download CSV / Excel formatted with UTF-8 BOM
  const handleDownloadCSV = () => {
    try {
      const headers = [
        "ลำดับ",
        "เลขที่ใบสั่งซื้อ",
        "วันที่สั่งซื้อ",
        "ชื่อร้านค้า",
        "ซัพพลายเออร์",
        "บาร์โค้ด",
        "ชื่อสินค้า",
        "โซน",
        "หมวดหมู่",
        "จำนวน",
        "หน่วยนับ",
        "ราคาทุนต่อหน่วย (บาท)",
        "ยอดรวม (บาท)",
        "หมายเหตุ",
      ];

      const rows = payload.items.map((item, idx) => [
        idx + 1,
        `"${payload.orderNumber}"`,
        `"${payload.createdAt}"`,
        `"${payload.storeName}"`,
        `"${payload.supplierName}"`,
        `"${item.barcode}"`,
        `"${item.productName.replace(/"/g, '""')}"`,
        `"${item.zoneName}"`,
        `"${item.categoryName}"`,
        item.quantity,
        `"${item.unitName}"`,
        item.costPrice.toFixed(2),
        item.total.toFixed(2),
        `"${(item.note || "").replace(/"/g, '""')}"`,
      ]);

      // Summary row
      rows.push([
        "",
        "",
        "",
        "",
        "",
        "",
        `"ยอดรวมทั้งสิ้น"`,
        "",
        "",
        payload.totalQuantity,
        `"ชิ้น"`,
        "",
        payload.totalCost.toFixed(2),
        "",
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PO-${payload.orderNumber}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลดไฟล์ Excel (CSV) สำเร็จ");
    } catch {
      toast.error("ไม่สามารถสร้างไฟล์ CSV ได้");
    }
  };

  // 2. Download JSON
  const handleDownloadJSON = () => {
    try {
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PO-${payload.orderNumber}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลดไฟล์ JSON สำเร็จ");
    } catch {
      toast.error("ไม่สามารถบันทึก JSON ได้");
    }
  };

  // 3. Generate Slip Image via Canvas
  const handleGenerateImage = () => {
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsGeneratingImage(false);
        return;
      }

      // High DPI settings
      const scale = 2;
      const width = 640;
      const padding = 32;
      const headerHeight = 160;
      const rowHeight = 36;
      const footerHeight = 180;
      const totalHeight = headerHeight + payload.items.length * rowHeight + footerHeight;

      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, totalHeight);

      // Top green brand bar
      ctx.fillStyle = "#059669";
      ctx.fillRect(0, 0, width, 8);

      // Store Title
      ctx.fillStyle = "#111827";
      ctx.font = "bold 20px Prompt, sans-serif";
      ctx.fillText(payload.storeName, padding, 40);

      // PO Subtitle & info
      ctx.fillStyle = "#6b7280";
      ctx.font = "13px Prompt, sans-serif";
      ctx.fillText(`ใบสั่งซื้อสินค้า • ${payload.orderNumber}`, padding, 64);
      ctx.fillText(`วันที่: ${payload.createdAt}`, padding, 84);
      ctx.fillText(`ซัพพลายเออร์: ${payload.supplierName}`, padding, 104);

      // Divider
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, 120);
      ctx.lineTo(width - padding, 120);
      ctx.stroke();

      // Table Header
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(padding, 130, width - padding * 2, 28);
      ctx.fillStyle = "#374151";
      ctx.font = "bold 12px Prompt, sans-serif";
      ctx.fillText("รายการสินค้า", padding + 8, 148);
      ctx.fillText("จำนวน", width - padding - 180, 148);
      ctx.fillText("ราคา/หน่วย", width - padding - 110, 148);
      ctx.fillText("ยอดรวม (฿)", width - padding - 40, 148);

      // Table Rows
      let currentY = 180;
      ctx.font = "12px Prompt, sans-serif";
      payload.items.forEach((item, idx) => {
        // Alternating background
        if (idx % 2 === 1) {
          ctx.fillStyle = "#f9fafb";
          ctx.fillRect(padding, currentY - 16, width - padding * 2, rowHeight);
        }

        ctx.fillStyle = "#111827";
        const truncatedName =
          item.productName.length > 28
            ? item.productName.substring(0, 26) + "..."
            : item.productName;
        ctx.fillText(`${idx + 1}. ${truncatedName}`, padding + 8, currentY);

        ctx.fillStyle = "#059669";
        ctx.font = "bold 12px Prompt, sans-serif";
        ctx.fillText(`${item.quantity} ${item.unitName}`, width - padding - 180, currentY);

        ctx.fillStyle = "#6b7280";
        ctx.font = "12px Prompt, sans-serif";
        ctx.fillText(`฿${item.costPrice.toFixed(0)}`, width - padding - 105, currentY);

        ctx.fillStyle = "#111827";
        ctx.font = "bold 12px Prompt, sans-serif";
        ctx.fillText(`฿${item.total.toFixed(0)}`, width - padding - 40, currentY);

        currentY += rowHeight;
      });

      // Bottom Divider
      ctx.beginPath();
      ctx.moveTo(padding, currentY + 8);
      ctx.lineTo(width - padding, currentY + 8);
      ctx.stroke();

      // Totals Box
      currentY += 28;
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(padding, currentY, width - padding * 2, 48);
      ctx.strokeStyle = "#a7f3d0";
      ctx.strokeRect(padding, currentY, width - padding * 2, 48);

      ctx.fillStyle = "#065f46";
      ctx.font = "bold 14px Prompt, sans-serif";
      ctx.fillText(`รวมทั้งหมด: ${payload.totalQuantity} ชิ้น`, padding + 16, currentY + 30);

      ctx.fillStyle = "#047857";
      ctx.font = "bold 16px Prompt, sans-serif";
      ctx.fillText(
        `฿${payload.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
        width - padding - 130,
        currentY + 30,
      );

      // Footer note
      currentY += 70;
      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px Prompt, sans-serif";
      ctx.fillText(
        `เอกสารสร้างอัตโนมัติจากระบบ MiniMark • สแกนและตรวจรับเข้าสต็อกได้ทันที`,
        padding,
        currentY,
      );

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setImageBlobUrl(url);
          setIsGeneratingImage(false);
          toast.success("สร้างภาพสลิปสำเร็จ");
        }
      }, "image/png");
    } catch {
      setIsGeneratingImage(false);
      toast.error("สร้างภาพสลิปไม่สำเร็จ");
    }
  };

  const handleDownloadImage = () => {
    if (!imageBlobUrl) {
      handleGenerateImage();
      return;
    }
    const link = document.createElement("a");
    link.href = imageBlobUrl;
    link.download = `PO-${payload.orderNumber}-slip.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("ดาวน์โหลดรูปภาพสำเร็จ");
  };

  const handleCopyImageToClipboard = async () => {
    if (!imageBlobUrl) return;
    try {
      const response = await fetch(imageBlobUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      toast.success("คัดลอกรูปภาพลง Clipboard สำเร็จ สามารถวาง (Paste) ใน LINE หรือแชทได้ทันที!");
    } catch {
      toast.error("เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพโดยตรง กรุณากดดาวน์โหลดแทน");
    }
  };

  // 4. Plain Text Formatted
  const formattedText = `📦 ใบสั่งซื้อสินค้า (Purchase Order) — ${payload.storeName}
เลขที่: ${payload.orderNumber}
วันที่: ${payload.createdAt}
ซัพพลายเออร์: ${payload.supplierName}
────────────────────
รายการสินค้า (รายการ -> จำนวน -> หน่วยนับ):
${payload.items.map((it, idx) => `${idx + 1}. ${it.productName} ➔ ${it.quantity} ${it.unitName} (฿${it.total.toFixed(0)})`).join("\n")}
────────────────────
รวมสินค้า: ${payload.totalQuantity} ชิ้น
ยอดเงินรวมทั้งสิ้น: ฿${payload.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
สร้างจากระบบ MiniMark POS & Stock Manager`;

  const handleCopyText = () => {
    try {
      navigator.clipboard.writeText(formattedText);
      setCopiedText(true);
      toast.success("คัดลอกข้อความสำเร็จ");
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast.error("ไม่สามารถคัดลอกข้อความได้");
    }
  };

  // 5. Native Print A4
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl rounded-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              ส่งออกและแชร์ใบสั่งซื้อ (Export PO in Various Formats)
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {payload.orderNumber}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            เลือกรูปแบบไฟล์ที่ต้องการส่งต่อให้ซัพพลายเออร์ หรือบันทึกลงเครื่อง: PDF, Excel (CSV),
            รูปภาพสลิป PNG, ข้อความแชท หรือ JSON
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as typeof activeTab);
            if (v === "image" && !imageBlobUrl) {
              handleGenerateImage();
            }
          }}
          className="space-y-4 pt-2"
        >
          <TabsList className="grid grid-cols-5 w-full h-11 p-1 bg-muted rounded-xl">
            <TabsTrigger value="pdf" className="text-xs gap-1.5 rounded-lg font-medium">
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">เอกสาร</span> PDF / A4
            </TabsTrigger>
            <TabsTrigger value="excel" className="text-xs gap-1.5 rounded-lg font-medium">
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Excel / CSV
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs gap-1.5 rounded-lg font-medium">
              <ImageIcon className="size-3.5 text-blue-600" />
              <span className="hidden sm:inline">รูปภาพ</span> สลิป PNG
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs gap-1.5 rounded-lg font-medium">
              <MessageSquare className="size-3.5 text-amber-600" />
              ข้อความแชท
            </TabsTrigger>
            <TabsTrigger value="json" className="text-xs gap-1.5 rounded-lg font-medium">
              <FileCode className="size-3.5 text-purple-600" />
              JSON Data
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PDF / A4 DOCUMENT */}
          <TabsContent value="pdf" className="space-y-3">
            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border">
              <div className="text-xs text-muted-foreground">
                เอกสารใบสั่งซื้อมาตรฐานขนาด A4 พร้อมรายละเอียดสินค้าและการลงนาม
              </div>
              <Button
                size="sm"
                className="gap-1.5 h-9 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handlePrint}
              >
                <Printer className="size-4" /> พิมพ์ / บันทึกเป็น PDF
              </Button>
            </div>

            {/* A4 Document Preview Card */}
            <div
              ref={printDocRef}
              className="rounded-xl border bg-white text-black p-6 sm:p-8 space-y-5 shadow-sm font-sans text-xs"
            >
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-900">
                    {payload.storeName}
                  </h2>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    123/45 ถนนพัฒนาการ แขวงสวนหลวง กรุงเทพฯ 10250
                  </p>
                  <p className="text-gray-600 text-[11px]">
                    โทรศัพท์: 02-123-4567 | อีเมล: store@minimark.local
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-base font-bold text-gray-900 font-mono">
                    {payload.orderNumber}
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    วันที่สั่งซื้อ: {payload.createdAt}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-gray-700">ผู้จัดจำหน่าย (Supplier): </span>
                  <span className="font-bold text-gray-900">{payload.supplierName}</span>
                </div>
                <div className="text-gray-500 text-[11px]">
                  จำนวนสินค้า: {payload.items.length} รายการ ({payload.totalQuantity} ชิ้น)
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5">รายการสินค้า</th>
                      <th className="p-2.5 w-28">บาร์โค้ด</th>
                      <th className="p-2.5 w-24">โซน/หมวดหมู่</th>
                      <th className="p-2.5 text-right w-24">จำนวน</th>
                      <th className="p-2.5 text-right w-24">ราคาทุน/หน่วย</th>
                      <th className="p-2.5 text-right w-28">ยอดรวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payload.items.map((item, idx) => (
                      <tr key={idx} className="text-gray-800">
                        <td className="p-2.5 text-center text-gray-500 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-medium">
                          <div>{item.productName}</div>
                          {item.note && (
                            <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block font-normal">
                              📌 {item.note}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-gray-500">
                          {item.barcode}
                        </td>
                        <td className="p-2.5 text-gray-500 text-[11px]">
                          {item.zoneName} / {item.categoryName}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {item.quantity} {item.unitName}
                        </td>
                        <td className="p-2.5 text-right font-mono">฿{item.costPrice.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          ฿{item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-gray-900">
                    <tr>
                      <td colSpan={4} className="p-3 text-right">
                        ยอดรวมทั้งสิ้น ({payload.totalQuantity} ชิ้น):
                      </td>
                      <td
                        colSpan={3}
                        className="p-3 text-right font-mono text-base text-emerald-700"
                      >
                        ฿{payload.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200">
                <div className="text-center space-y-8">
                  <div className="text-gray-600 text-[11px]">ผู้จัดทำใบสั่งซื้อ (Purchaser)</div>
                  <div className="border-b border-gray-400 w-48 mx-auto" />
                  <div className="text-gray-500 text-[11px]">วันที่ ____ / ____ / ________</div>
                </div>
                <div className="text-center space-y-8">
                  <div className="text-gray-600 text-[11px]">
                    ผู้อนุมัติ / เจ้าของร้าน (Approved by)
                  </div>
                  <div className="border-b border-gray-400 w-48 mx-auto" />
                  <div className="text-gray-500 text-[11px]">วันที่ ____ / ____ / ________</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: EXCEL / CSV */}
          <TabsContent value="excel" className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-2">
              <h3 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <FileSpreadsheet className="size-4" /> ส่งออกไฟล์ Excel (.CSV พร้อมรองรับภาษาไทย
                UTF-8 BOM)
              </h3>
              <p className="text-xs text-muted-foreground">
                ไฟล์ CSV ที่สร้างขึ้นจะถูกเข้ารหัส UTF-8 with BOM สามารถเปิดบน Microsoft Excel,
                Google Sheets หรือ Numbers ได้ทันทีโดยภาษาไทยไม่เพี้ยน
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <Button
                  className="gap-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleDownloadCSV}
                >
                  <Download className="size-4" /> ดาวน์โหลดไฟล์ Excel (CSV)
                </Button>

                <Button
                  variant="outline"
                  className="gap-2 rounded-xl font-semibold border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={handleExportGoogleSheets}
                  disabled={isExportingGoogleSheets}
                >
                  {isExportingGoogleSheets ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-4 text-emerald-600" />
                  )}
                  ส่งออกสู่ Google Sheets
                </Button>

                {googleSheetsUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="gap-1.5 text-xs text-primary underline"
                  >
                    <a href={googleSheetsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" /> เปิดใน Google Sheets
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Quick CSV Table Preview */}
            <div className="rounded-xl border overflow-x-auto max-h-64">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted font-semibold">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">บาร์โค้ด</th>
                    <th className="p-2">ชื่อสินค้า</th>
                    <th className="p-2">โซน</th>
                    <th className="p-2">หมวดหมู่</th>
                    <th className="p-2 text-right">จำนวน</th>
                    <th className="p-2 text-right">ราคาทุน</th>
                    <th className="p-2 text-right">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payload.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-2 font-mono">{idx + 1}</td>
                      <td className="p-2 font-mono">{it.barcode}</td>
                      <td className="p-2 font-medium">{it.productName}</td>
                      <td className="p-2 text-muted-foreground">{it.zoneName}</td>
                      <td className="p-2 text-muted-foreground">{it.categoryName}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {it.quantity} {it.unitName}
                      </td>
                      <td className="p-2 text-right font-mono">฿{it.costPrice.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold">฿{it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 3: IMAGE / PNG SLIP */}
          <TabsContent value="image" className="space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl space-y-2">
              <h3 className="font-semibold text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <ImageIcon className="size-4" /> สลิปภาพใบสั่งซื้อ (PNG Slip Image)
              </h3>
              <p className="text-xs text-muted-foreground">
                สร้างภาพใบสั่งซื้ออัตโนมัติ สำหรับส่งเป็นรูปภาพเข้าแชท LINE, WhatsApp หรือ Messenger
                ได้ทันที
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  className="gap-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleDownloadImage}
                  disabled={isGeneratingImage}
                >
                  <Download className="size-4" /> ดาวน์โหลดรูปภาพ PNG
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl font-semibold border-blue-500/30 text-blue-700 dark:text-blue-300"
                  onClick={handleCopyImageToClipboard}
                  disabled={!imageBlobUrl || isGeneratingImage}
                >
                  <Copy className="size-4" /> คัดลอกรูปภาพลง Clipboard (Copy Image)
                </Button>
              </div>
            </div>

            {/* Image Preview Container */}
            <div className="flex justify-center p-4 bg-muted/30 rounded-xl border min-h-[250px] items-center">
              {isGeneratingImage ? (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  กำลังสร้างรูปภาพความละเอียดสูง...
                </div>
              ) : imageBlobUrl ? (
                <img
                  src={imageBlobUrl}
                  alt="PO Slip Preview"
                  className="max-w-full sm:max-w-md rounded-xl shadow-md border"
                />
              ) : (
                <Button variant="secondary" onClick={handleGenerateImage}>
                  กดเพื่อสร้างตัวอย่างภาพสลิป
                </Button>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: CHAT / TEXT */}
          <TabsContent value="text" className="space-y-3">
            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border">
              <div className="text-xs text-muted-foreground">
                ข้อความสรุปพร้อมอิโมจิ เหมาะสำหรับคัดลอกส่งใน LINE หรือ SMS
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-9 rounded-xl font-semibold border-amber-500/40 text-amber-700 dark:text-amber-300"
                onClick={handleCopyText}
              >
                {copiedText ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copiedText ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
              </Button>
            </div>

            <textarea
              readOnly
              className="w-full h-56 p-3 font-mono text-xs rounded-xl border bg-card text-foreground focus:outline-none resize-none leading-relaxed"
              value={formattedText}
            />
          </TabsContent>

          {/* TAB 5: JSON DATA */}
          <TabsContent value="json" className="space-y-3">
            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border">
              <div className="text-xs text-muted-foreground">
                โครงสร้างข้อมูล JSON สำหรับนำไปเชื่อมต่อ API หรือฐานข้อมูลภายนอก
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-9 rounded-xl font-semibold border-purple-500/40 text-purple-700 dark:text-purple-300"
                onClick={handleDownloadJSON}
              >
                <Download className="size-4" /> ดาวน์โหลด .json
              </Button>
            </div>

            <pre className="p-3 bg-muted rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 text-muted-foreground">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2 border-t">
          <Button
            variant="secondary"
            className="w-full sm:w-auto rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            ปิดหน้าต่าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
