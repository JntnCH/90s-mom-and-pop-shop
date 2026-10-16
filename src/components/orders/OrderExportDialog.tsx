import {
  Check,
  ClipboardCopy,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Printer,
  Share2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
  exportOrderToCSV,
  exportOrderToFlexJSON,
  exportOrderToJSON,
  exportOrderToTXT,
  printOrderAsPDF,
  type ExportOrderPayload,
} from "@/lib/order-export";
import { DEFAULT_STORE_NAME, getSystemStoreName } from "@/lib/flex-templates";

interface OrderExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderPayload: ExportOrderPayload | null;
}

export function OrderExportDialog({ open, onOpenChange, orderPayload }: OrderExportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [flexFormat, setFlexFormat] = useState<"carousel" | "bubble">("carousel");

  if (!orderPayload) return null;

  const handleCopyText = () => {
    const store = getSystemStoreName(orderPayload.storeName);
    let txt = `📦 ใบสั่งซื้อสินค้า ${orderPayload.orderNumber} (${store})\n`;
    txt += `วันที่: ${orderPayload.createdAt}\n`;
    txt += `ซัพพลายเออร์: ${orderPayload.supplierName || "ทั่วไป"}\n`;
    txt += `--------------------\n`;
    orderPayload.items.forEach((item, idx) => {
      txt += `${idx + 1}. ${item.productName} ➔ ${item.quantity} ${item.unitName} (฿${item.total.toFixed(2)})\n`;
    });
    txt += `--------------------\n`;
    txt += `รวม: ${orderPayload.totalQuantity} หน่วย | ยอดรวม: ฿${orderPayload.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;

    navigator.clipboard.writeText(txt);
    setCopied(true);
    toast.success("คัดลอกข้อความใบสั่งซื้อแล้ว");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-md rounded-2xl p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
            <Download className="size-5 text-primary" /> ส่งออกไฟล์รายการสั่งซื้อ
          </DialogTitle>
          <DialogDescription className="text-xs">
            เลือกรูปแบบไฟล์ที่ต้องการบันทึก หรือส่งต่อให้ซัพพลายเออร์
          </DialogDescription>
        </DialogHeader>

        {/* Order Summary Snapshot */}
        <div className="rounded-xl border bg-muted/50 p-3 space-y-1 text-xs">
          <div className="flex justify-between font-bold text-foreground">
            <span>เลขที่: {orderPayload.orderNumber}</span>
            <span className="font-mono text-emerald-600">
              ฿{orderPayload.totalCost.toLocaleString("th-TH")}
            </span>
          </div>
          <div className="text-muted-foreground flex justify-between text-[11px]">
            <span>
              สินค้า {orderPayload.items.length} รายการ ({orderPayload.totalQuantity} หน่วย)
            </span>
            <span>{orderPayload.createdAt}</span>
          </div>
        </div>

        {/* Featured Option: LINE Flex Message (.JSON) with 1. Carousel & 2. Bubble */}
        <div className="pt-1 pb-0.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <span>รูปแบบ Flex:</span>
            </span>
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border">
              <button
                type="button"
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                  flexFormat === "carousel"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFlexFormat("carousel")}
              >
                1. 🎠 Carousel
              </button>
              <button
                type="button"
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                  flexFormat === "bubble"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFlexFormat("bubble")}
              >
                2. 💬 Bubble
              </button>
            </div>
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-between p-3 rounded-2xl border-2 border-[#06C755]/40 bg-emerald-50/60 dark:bg-emerald-950/30 hover:border-[#06C755] hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50 transition-all text-left group active:scale-98"
            onClick={() => {
              exportOrderToFlexJSON(orderPayload, { containerType: flexFormat });
              toast.success(
                `ดาวน์โหลดไฟล์ LINE Flex Message (${
                  flexFormat === "carousel" ? "1. Carousel" : "2. Bubble"
                }) สำเร็จ พร้อมใช้ใน LINE Simulator`,
              );
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-[#06C755] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <MessageCircle className="size-5 fill-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                    LINE Flex ({flexFormat === "carousel" ? "1. Carousel" : "2. Bubble"}) (.JSON)
                  </span>
                  <Badge className="bg-[#06C755] text-white text-[9px] h-4 px-1.5 font-semibold">
                    {flexFormat === "carousel" ? "สไลด์การ์ด" : "การ์ดยาว"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {flexFormat === "carousel"
                    ? "แบบ Carousel สไลด์หลายการ์ด แยกตามหมวดหมู่"
                    : "แบบ Bubble การ์ดยาวแผ่นเดียว รวมทุกรายการ"}
                </p>
              </div>
            </div>
            <div className="size-8 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 ml-2">
              <Download className="size-4" />
            </div>
          </button>
        </div>

        {/* File Format Options Grid */}
        <div className="grid grid-cols-2 gap-2.5 py-2">
          {/* Option 1: Excel CSV */}
          <button
            type="button"
            className="flex flex-col items-start p-3.5 rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-left group active:scale-98"
            onClick={() => {
              exportOrderToCSV(orderPayload);
              toast.success("ดาวน์โหลดไฟล์ Excel (.csv) สำเร็จ");
            }}
          >
            <div className="size-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="size-5" />
            </div>
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
              Excel (.CSV)
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              ตารางข้อมูลภาษาไทย เปิดใน Excel ได้ทันที
            </span>
          </button>

          {/* Option 2: PDF Document */}
          <button
            type="button"
            className="flex flex-col items-start p-3.5 rounded-2xl border-2 border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-left group active:scale-98"
            onClick={() => {
              printOrderAsPDF(orderPayload);
            }}
          >
            <div className="size-9 rounded-xl bg-rose-500 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <Printer className="size-5" />
            </div>
            <span className="text-xs font-bold text-rose-900 dark:text-rose-100">
              พิมพ์ / PDF (A4)
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              เอกสารทางการพร้อมช่องลงนามอนุมัติ
            </span>
          </button>

          {/* Option 3: TXT Text File */}
          <button
            type="button"
            className="flex flex-col items-start p-3.5 rounded-2xl border-2 border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all text-left group active:scale-98"
            onClick={() => {
              exportOrderToTXT(orderPayload);
              toast.success("ดาวน์โหลดไฟล์ข้อความ (.txt) สำเร็จ");
            }}
          >
            <div className="size-9 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <FileText className="size-5" />
            </div>
            <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
              ข้อความ (.TXT)
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              ไฟล์ข้อความจัดฟอร์แมต สรุปรายการชัดเจน
            </span>
          </button>

          {/* Option 4: JSON Data */}
          <button
            type="button"
            className="flex flex-col items-start p-3.5 rounded-2xl border-2 border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all text-left group active:scale-98"
            onClick={() => {
              exportOrderToJSON(orderPayload);
              toast.success("ดาวน์โหลดไฟล์ JSON สำเร็จ");
            }}
          >
            <div className="size-9 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
              <FileCode2 className="size-5" />
            </div>
            <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
              ข้อมูลดิจิทัล (.JSON)
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              สำหรับเชื่อมต่อระบบสต็อกและบัญชี
            </span>
          </button>
        </div>

        {/* Quick Copy Action */}
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 rounded-xl text-xs gap-2"
            onClick={handleCopyText}
          >
            {copied ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <ClipboardCopy className="size-4" />
            )}
            {copied ? "คัดลอกข้อความแล้ว" : "คัดลอกข้อความใบสั่งซื้อ (Copy to Clipboard)"}
          </Button>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button
            variant="secondary"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            ปิดหน้าต่าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
