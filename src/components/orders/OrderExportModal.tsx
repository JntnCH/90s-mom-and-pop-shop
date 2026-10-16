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
  MessageCircle,
  MessageSquare,
  Printer,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createNewSpreadsheet,
  getGoogleAccessToken,
  signInWithGoogle,
} from "@/lib/google-sheets-service";
import { FlexMessageVisualizer } from "@/components/line/FlexMessageVisualizer";
import type { FlexContainerType, FlexItemGroupBy } from "@/lib/flex-templates";
import {
  buildOrderFlexMessageFromPayload,
  copyTextToClipboard,
  downloadJsonFile,
} from "@/lib/order-export";
import { shareFlexViaLiffPicker } from "@/lib/line-service";
import {
  generatePurchaseOrderSlipImage,
  shareImageFileViaNavigator,
  type SlipDesignStyle,
} from "@/lib/slip-image-generator";

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
  const [activeTab, setActiveTab] = useState<"pdf" | "excel" | "image" | "flex" | "text" | "json">(
    "pdf",
  );
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [imagePreviewMode, setImagePreviewMode] = useState<"full" | "mockup">("full");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const printDocRef = useRef<HTMLDivElement>(null);
  const [isExportingGoogleSheets, setIsExportingGoogleSheets] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string | null>(null);
  const [isSendingLineImage, setIsSendingLineImage] = useState(false);
  const [exportSlipStyle, setExportSlipStyle] = useState<SlipDesignStyle>("full_bleed_rich");

  const [flexContainerType, setFlexContainerType] = useState<FlexContainerType>("carousel");
  const [flexGroupBy, setFlexGroupBy] = useState<FlexItemGroupBy>("category_no_header");
  const [copiedFlexJson, setCopiedFlexJson] = useState(false);

  const currentFlexMessage = useMemo(() => {
    if (!payload) return null;
    return buildOrderFlexMessageFromPayload(payload, {
      groupBy: flexGroupBy,
      showGroupHeaders:
        flexGroupBy !== "none" &&
        flexGroupBy !== "category_no_header" &&
        flexGroupBy !== "zone_no_header",
      containerType: flexContainerType,
    });
  }, [payload, flexGroupBy, flexContainerType]);

  const handleDownloadFlexJSON = () => {
    if (!payload || !currentFlexMessage) return;
    downloadJsonFile(
      currentFlexMessage,
      `PO_${payload.orderNumber}_flex_${flexContainerType}.json`,
    );
    toast.success(
      `ดาวน์โหลดไฟล์ LINE Flex Message (${
        flexContainerType === "carousel" ? "1. Carousel" : "2. Bubble"
      }) สำเร็จ`,
    );
  };

  const handleCopyFlexJSON = async () => {
    if (!currentFlexMessage) return;
    const jsonStr = JSON.stringify(currentFlexMessage, null, 2);
    const success = await copyTextToClipboard(jsonStr);
    if (success) {
      setCopiedFlexJson(true);
      toast.success(
        `คัดลอก Flex JSON (${
          flexContainerType === "carousel" ? "Carousel" : "Bubble"
        }) สำเร็จ นำไปวางใน LINE Simulator ได้ทันที`,
      );
      setTimeout(() => setCopiedFlexJson(false), 2000);
    } else {
      toast.error("ไม่สามารถคัดลอกได้ กรุณาใช้ปุ่มดาวน์โหลด .json");
    }
  };

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

  // 3. Generate Slip Image via High-DPI Generator
  const handleGenerateImage = async (styleOverride?: SlipDesignStyle) => {
    setIsGeneratingImage(true);
    const chosenStyle = styleOverride || exportSlipStyle;
    try {
      const res = await generatePurchaseOrderSlipImage({
        orderNumber: payload.orderNumber,
        createdAt: payload.createdAt,
        storeName: payload.storeName,
        supplierName: payload.supplierName,
        style: chosenStyle,
        items: payload.items.map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          unitName: i.unitName,
          costPrice: i.costPrice,
          total: i.total,
          barcode: i.barcode,
          zoneName: i.zoneName,
          categoryName: i.categoryName,
          note: i.note,
        })),
        totalQuantity: payload.totalQuantity,
        totalCost: payload.totalCost,
      });

      const url = URL.createObjectURL(res.blob);
      setImageBlobUrl(url);
      setIsGeneratingImage(false);
      toast.success(
        chosenStyle === "full_bleed_rich"
          ? "สร้างภาพแบนเนอร์เต็มจอ 1040px สำเร็จ (สไตล์ตัวอย่างรูปภาพ ttb)"
          : "สร้างภาพสลิปใบเสร็จสำเร็จ",
      );
    } catch (err) {
      console.error("Failed generating export slip:", err);
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

  const handleShareImageToLine = async () => {
    try {
      setIsSendingLineImage(true);
      let dataUrl = "";
      if (imageCanvasRef.current) {
        dataUrl = imageCanvasRef.current.toDataURL("image/png");
      }
      if (!dataUrl) {
        handleGenerateImage();
        await new Promise((r) => setTimeout(r, 200));
        if (imageCanvasRef.current) {
          dataUrl = imageCanvasRef.current.toDataURL("image/png");
        }
      }
      if (!dataUrl) {
        toast.error("กรุณากดสร้างรูปภาพสลิปก่อนส่งเข้า LINE");
        return;
      }

      const res = await shareFlexViaLiffPicker(null, {
        format: "IMAGE_PNG",
        imageBase64: dataUrl,
        altSummary: `📦 รูปภาพสลิปใบสั่งซื้อ ${payload.orderNumber} (${payload.storeName})`,
      });

      if (res.success) {
        toast.success("ส่งรูปภาพสลิป PNG เข้าแชท LINE สำเร็จแล้ว");
      } else if (res.needLiffId) {
        toast.error("กรุณาระบุ LINE LIFF ID ในการตั้งค่า LINE ก่อนเปิดแผ่นเลือกเพื่อน");
      } else {
        toast.error(res.message || "ส่งรูปภาพเข้า LINE ไม่สำเร็จ");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSendingLineImage(false);
    }
  };

  const handleWebShareImage = async () => {
    if (!imageBlobUrl) {
      handleGenerateImage();
      return;
    }
    try {
      const response = await fetch(imageBlobUrl);
      const blob = await response.blob();
      const ok = await shareImageFileViaNavigator(
        blob,
        `PO-${payload.orderNumber}-slip.png`,
        `ใบสั่งซื้อ ${payload.orderNumber}`,
        `ใบสั่งซื้อ ${payload.orderNumber} จาก ${payload.storeName}`,
      );
      if (!ok) {
        toast.info("เปิดการแชร์บนอุปกรณ์");
      }
    } catch {
      toast.error("ไม่สามารถแชร์รูปภาพได้");
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
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto p-1 bg-muted rounded-xl gap-1">
            <TabsTrigger value="pdf" className="text-xs gap-1.5 rounded-lg font-medium py-2">
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">เอกสาร</span> PDF / A4
            </TabsTrigger>
            <TabsTrigger value="excel" className="text-xs gap-1.5 rounded-lg font-medium py-2">
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Excel / CSV
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs gap-1.5 rounded-lg font-medium py-2">
              <ImageIcon className="size-3.5 text-blue-600" />
              <span className="hidden sm:inline">รูปภาพ</span> สลิป PNG
            </TabsTrigger>
            <TabsTrigger
              value="flex"
              className="text-xs gap-1.5 rounded-lg font-medium py-2 text-[#06C755] dark:text-[#06C755] data-[state=active]:bg-background data-[state=active]:text-[#06C755] data-[state=active]:font-bold"
            >
              <MessageCircle className="size-3.5 fill-[#06C755]/20" />
              <span className="hidden sm:inline">LINE</span> Flex
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs gap-1.5 rounded-lg font-medium py-2">
              <MessageSquare className="size-3.5 text-amber-600" />
              ข้อความแชท
            </TabsTrigger>
            <TabsTrigger value="json" className="text-xs gap-1.5 rounded-lg font-medium py-2">
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
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                    <ImageIcon className="size-4" /> ภาพสลิปใบสั่งซื้อ PNG เต็มจอ (1040px)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    สร้างภาพใบสั่งซื้ออัตโนมัติ สำหรับส่งเป็นรูปภาพเข้าแชท LINE เต็มจอ ไร้ขอบขาว
                    (Rich Message)
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant={exportSlipStyle === "full_bleed_rich" ? "default" : "outline"}
                    className={`h-7 px-2.5 text-xs rounded-lg font-bold gap-1 ${
                      exportSlipStyle === "full_bleed_rich"
                        ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-xs"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => {
                      setExportSlipStyle("full_bleed_rich");
                      handleGenerateImage("full_bleed_rich");
                    }}
                  >
                    🌟 เต็มจอแบบตัวอย่าง (ttb Style)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={exportSlipStyle === "receipt" ? "default" : "outline"}
                    className={`h-7 px-2.5 text-xs rounded-lg ${
                      exportSlipStyle === "receipt"
                        ? "bg-emerald-600 text-white font-bold"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => {
                      setExportSlipStyle("receipt");
                      handleGenerateImage("receipt");
                    }}
                  >
                    📄 สลิปใบเสร็จมาตรฐาน
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  className="gap-2 rounded-xl font-bold bg-[#06C755] hover:bg-[#05b34c] text-white shadow-2xs"
                  onClick={handleShareImageToLine}
                  disabled={isSendingLineImage || isGeneratingImage}
                >
                  {isSendingLineImage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageCircle className="size-4" />
                  )}
                  {isSendingLineImage ? "กำลังส่ง..." : "ส่งรูปภาพสลิปเข้า LINE (Share Picker)"}
                </Button>
                <Button
                  className="gap-2 rounded-xl font-semibold bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleDownloadImage}
                  disabled={isGeneratingImage}
                >
                  <Download className="size-4" /> ดาวน์โหลด PNG (1040px)
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl font-semibold border-orange-500/30 text-orange-700 dark:text-orange-300"
                  onClick={handleCopyImageToClipboard}
                  disabled={!imageBlobUrl || isGeneratingImage}
                >
                  <Copy className="size-4" /> คัดลอกภาพลง Clipboard
                </Button>
                {typeof navigator !== "undefined" && navigator.canShare && (
                  <Button
                    variant="outline"
                    className="gap-2 rounded-xl font-semibold border-muted-foreground/30 text-foreground"
                    onClick={handleWebShareImage}
                    disabled={isGeneratingImage}
                  >
                    <Share2 className="size-4" /> แชร์รูปภาพ (Share)
                  </Button>
                )}
              </div>
            </div>

            {/* Image Display Mode Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <span>โหมดการแสดงภาพ:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant={imagePreviewMode === "full" ? "default" : "outline"}
                  className="h-7.5 px-3 text-xs rounded-lg font-semibold gap-1.5"
                  onClick={() => setImagePreviewMode("full")}
                >
                  🖼️ ภาพเต็มความกว้าง (ชัดเจน ตัวอักษรใหญ่)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={imagePreviewMode === "mockup" ? "default" : "outline"}
                  className="h-7.5 px-3 text-xs rounded-lg font-semibold gap-1.5"
                  onClick={() => setImagePreviewMode("mockup")}
                >
                  📱 จำลองแชท LINE
                </Button>
                {imageBlobUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7.5 px-2.5 text-xs rounded-lg font-semibold gap-1 text-primary hover:bg-primary/10"
                    onClick={() => setIsLightboxOpen(true)}
                  >
                    🔍 ขยายเต็มจอ
                  </Button>
                )}
              </div>
            </div>

            {/* Image Preview Container */}
            <div className="flex justify-center p-3 sm:p-5 bg-muted/30 rounded-2xl border min-h-[300px] items-center overflow-x-auto">
              {isGeneratingImage ? (
                <div className="text-center text-xs text-muted-foreground animate-pulse p-8">
                  กำลังสร้างรูปภาพความละเอียดสูง 1040px คมชัด ไร้รอยแตก...
                </div>
              ) : imageBlobUrl ? (
                imagePreviewMode === "full" ? (
                  /* Full-width responsive container (big text, full screen presence) */
                  <div className="w-full max-w-[850px] mx-auto rounded-2xl overflow-hidden shadow-xl border border-black/10 bg-white">
                    <img
                      src={imageBlobUrl}
                      alt="PO Slip Full Preview"
                      className="w-full h-auto object-contain block cursor-pointer transition-opacity hover:opacity-95"
                      onClick={() => setIsLightboxOpen(true)}
                      title="กดเพื่อขยายเต็มจอ"
                    />
                  </div>
                ) : (
                  /* Mobile Device Mockup */
                  <div className="w-full max-w-[420px] rounded-3xl overflow-hidden shadow-xl border border-black/15 bg-[#f7f5f2] dark:bg-[#1f2937] flex flex-col">
                    {/* LINE Chat Header */}
                    <div className="bg-[#f0ebe3] dark:bg-[#1a232d] px-3.5 py-2 border-b border-black/10 flex items-center justify-between text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          ‹ 99+
                        </span>
                        <div className="ml-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="size-3 rounded-full bg-[#06C755] text-white flex items-center justify-center text-[8px] font-bold">
                              ✓
                            </span>
                            <span className="text-xs font-bold truncate">{payload.storeName}</span>
                          </div>
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-none">
                            ตอบกลับอัตโนมัติ
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-400 text-xs">
                        <span>🔍</span>
                        <span>☰</span>
                      </div>
                    </div>

                    {/* Date Divider */}
                    <div className="py-2 flex justify-center">
                      <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 bg-black/10 dark:bg-white/10 px-2.5 py-0.5 rounded-full select-none">
                        อ. 29/9
                      </span>
                    </div>

                    {/* Edge-to-Edge Image Container */}
                    <div className="px-2 py-1 flex flex-col items-center">
                      <div className="w-full rounded-2xl overflow-hidden shadow-md border border-black/10 bg-white">
                        <img
                          src={imageBlobUrl}
                          alt="PO Slip Preview"
                          className="w-full h-auto object-cover block cursor-pointer"
                          onClick={() => setIsLightboxOpen(true)}
                        />
                      </div>
                      <div className="w-full text-right pr-2 pt-1">
                        <span className="text-[9px] text-zinc-500 font-medium">19:00</span>
                      </div>
                    </div>

                    {/* Simulated Bottom Menu */}
                    <div className="mt-1 bg-[#f0ebe3] dark:bg-[#1a232d] px-3 py-1.5 border-t border-black/10 flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px]">
                          ⌨️
                        </span>
                        <span className="text-[11px] text-zinc-400">พิมพ์ข้อความ...</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-zinc-200/60 dark:bg-zinc-700/60 rounded">
                        เมนู ▲
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <Button variant="secondary" onClick={() => handleGenerateImage(exportSlipStyle)}>
                  กดเพื่อสร้างตัวอย่างภาพสลิปเต็มจอ (1040px)
                </Button>
              )}
            </div>

            {/* Lightbox Dialog for Full-screen Image Viewing */}
            <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
              <DialogContent className="w-[98vw] max-w-6xl max-h-[96vh] p-2 bg-black/90 border-zinc-800 text-white overflow-y-auto">
                <div className="flex justify-between items-center p-2 border-b border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-300">
                    ภาพใบสั่งซื้อความละเอียดสูง (1040px)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-zinc-300 hover:text-white"
                    onClick={() => setIsLightboxOpen(false)}
                  >
                    ปิด
                  </Button>
                </div>
                {imageBlobUrl && (
                  <div className="flex justify-center p-2">
                    <img
                      src={imageBlobUrl}
                      alt="Full Screen High-Res PO Slip"
                      className="max-h-[85vh] w-auto object-contain rounded-lg shadow-2xl"
                    />
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* TAB: LINE FLEX MESSAGE */}
          <TabsContent value="flex" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-muted/40 p-3 rounded-xl border">
              <div>
                <h3 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                  <MessageCircle className="size-4 text-[#06C755]" />
                  LINE Flex Message (สำหรับแอป LINE & LINE Simulator)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  รองรับทั้ง <strong>1. Carousel (สไลด์หลายการ์ด)</strong> และ{" "}
                  <strong>2. Bubble (การ์ดเดี่ยวยาว)</strong> พร้อมดาวน์โหลดไปใช้งานได้ทันที
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8.5 text-xs rounded-xl gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  onClick={handleCopyFlexJSON}
                >
                  {copiedFlexJson ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copiedFlexJson ? "คัดลอกแล้ว!" : "คัดลอก Flex JSON"}
                </Button>
                <Button
                  size="sm"
                  className="h-8.5 text-xs rounded-xl font-bold gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white shadow-xs"
                  onClick={handleDownloadFlexJSON}
                >
                  <Download className="size-3.5" />
                  ดาวน์โหลด Flex (.json)
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8.5 text-xs rounded-xl gap-1 text-muted-foreground hover:text-foreground"
                >
                  <a
                    href="https://developers.line.biz/flex-simulator/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3" /> เปิด Simulator
                  </a>
                </Button>
              </div>
            </div>

            {/* Flex Options & Format Selector (Carousel vs Bubble) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/30 border text-xs">
              {/* 1. Format Choice: Carousel vs Bubble */}
              <div className="space-y-1.5">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span>รูปแบบ Flex Message:</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  >
                    เลือกส่งออกได้ 2 แบบ
                  </Badge>
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                      flexContainerType === "carousel"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-xs"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setFlexContainerType("carousel")}
                  >
                    <div className="text-xs font-bold">1. 🎠 Carousel</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      การ์ดสไลด์หลายหน้า / แยกหมวดหมู่
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                      flexContainerType === "bubble"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-xs"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setFlexContainerType("bubble")}
                  >
                    <div className="text-xs font-bold">2. 💬 Bubble</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      การ์ดยาวแผ่นเดียว รวมทุกรายการ
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Grouping Choice */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <SlidersHorizontal className="size-3.5 text-emerald-600" />
                  <span>การจัดกลุ่มสินค้า:</span>
                </div>
                <select
                  className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold shadow-xs"
                  value={flexGroupBy}
                  onChange={(e) => setFlexGroupBy(e.target.value as FlexItemGroupBy)}
                >
                  <option value="category_no_header">
                    🏷️ ตามหมวดหมู่ (ไม่แสดงหมวดหมู่ใน Flex - แนะนำ)
                  </option>
                  <option value="none">📄 ตามลำดับเดิม (ไม่มีแถบหัวข้อ)</option>
                  <option value="zone_no_header">📍 ตามโซน (ไม่แสดงแถบหัวข้อใน Flex)</option>
                  <option value="category">🏷️ ตามหมวดหมู่สินค้า (แสดงแถบหัวข้อหมวด)</option>
                  <option value="zone">📍 ตามโซนจัดวางสินค้า (แสดงแถบหัวข้อโซน)</option>
                  <option value="zone_then_category">
                    📍 โซน ➔ 🏷️ หมวดหมู่สินค้า (แสดงแถบหัวข้อ)
                  </option>
                </select>
              </div>
            </div>

            {/* Universal Visual Preview */}
            <div className="rounded-xl border overflow-hidden">
              <FlexMessageVisualizer
                flexData={currentFlexMessage}
                title={`LINE Flex (${flexContainerType === "carousel" ? "1. Carousel" : "2. Bubble"}) — ใบสั่งซื้อ ${payload.orderNumber}`}
              />
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
