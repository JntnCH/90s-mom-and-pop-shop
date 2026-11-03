import React, { useState } from "react";
import {
  FileText,
  Calendar,
  Building2,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  X,
  CreditCard,
  User,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type ExpenseDocument, expenseService } from "@/lib/expense-service";
import { toast } from "sonner";

interface ExpenseDetailModalProps {
  document: ExpenseDocument | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function ExpenseDetailModal({ document: doc, onClose, onDeleted }: ExpenseDetailModalProps) {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  if (!doc) return null;

  const isPurchase = doc.docType === "PURCHASE_GOODS";

  const handleDelete = () => {
    if (confirm(`คุณต้องการลบเอกสารรายจ่ายเลขที่ "${doc.docNumber}" หรือไม่?`)) {
      expenseService.deleteExpense(doc.id);
      toast.success(`ลบเอกสาร ${doc.docNumber} เรียบร้อยแล้ว`);
      if (onDeleted) onDeleted();
      onClose();
    }
  };

  return (
    <>
      <Dialog open={Boolean(doc)} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base sm:text-lg font-bold font-mono">
                    {doc.docNumber}
                  </DialogTitle>
                  {isPurchase ? (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      🛒 บิลซื้อสินค้าเข้าร้าน
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-600 text-white text-[10px]">
                      💡 บิลค่าใช้จ่ายทั่วไป
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {doc.category}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  ออกโดย {doc.merchantName} • วันที่ {doc.docDate}
                </DialogDescription>
              </div>

              {doc.originalImageUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs gap-1.5 self-start sm:self-auto font-semibold"
                  onClick={() => setImagePreviewOpen(true)}
                >
                  <Eye className="size-3.5 text-primary" /> ดูรูปถ่ายบิลต้นฉบับ
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* DOCUMENT SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2 text-xs">
            <div className="rounded-xl border p-2.5 bg-muted/30 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">ยอดรวมสุทธิ</span>
              <div className="text-base font-bold font-mono text-primary">
                ฿{doc.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-xl border p-2.5 bg-muted/30 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">ภาษีมูลค่าเพิ่ม (VAT)</span>
              <div className="text-sm font-semibold font-mono text-foreground">
                ฿{doc.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-xl border p-2.5 bg-muted/30 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">วิธีชำระเงิน</span>
              <div className="text-sm font-semibold text-foreground">
                {doc.paymentMethod === "CASH"
                  ? "เงินสด"
                  : doc.paymentMethod === "PROMPTPAY"
                    ? "พร้อมเพย์"
                    : doc.paymentMethod === "BANK_TRANSFER"
                      ? "โอนธนาคาร"
                      : doc.paymentMethod === "CREDIT_CARD"
                        ? "บัตรเครดิต"
                        : "อื่นๆ"}
              </div>
            </div>

            <div className="rounded-xl border p-2.5 bg-muted/30 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">สถานะสต็อก</span>
              <div className="text-xs font-semibold">
                {isPurchase ? (
                  doc.isStockUpdated ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> เพิ่มสต็อกแล้ว
                    </span>
                  ) : (
                    <span className="text-muted-foreground">ยังไม่เพิ่มสต็อก</span>
                  )
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="size-3.5" /> ไม่กระทบสต็อก
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* VENDOR & METADATA INFO */}
          <div className="rounded-xl border p-3 bg-card space-y-1 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
              <div>
                ร้านค้า/ผู้จำหน่าย: <strong className="text-foreground">{doc.merchantName}</strong>
              </div>
              {doc.merchantTaxId && (
                <div>
                  เลขผู้เสียภาษี:{" "}
                  <strong className="font-mono text-foreground">{doc.merchantTaxId}</strong>
                </div>
              )}
              {doc.merchantBranch && (
                <div>
                  สาขา: <strong className="text-foreground">{doc.merchantBranch}</strong>
                </div>
              )}
              <div>
                ผู้บันทึก: <strong className="text-foreground">{doc.operator || "ระบบ"}</strong>
              </div>
              <div>
                บันทึกเมื่อ:{" "}
                <strong className="font-mono text-foreground">
                  {new Date(doc.createdAt).toLocaleString("th-TH")}
                </strong>
              </div>
            </div>
            {doc.note && (
              <div className="pt-1.5 border-t text-muted-foreground mt-1">
                หมายเหตุ: <span className="text-foreground">{doc.note}</span>
              </div>
            )}
          </div>

          {/* ITEMS LIST */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>รายการสินค้า / ค่าใช้จ่าย ({doc.items.length} รายการ)</span>
              {isPurchase && (
                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                  * รายการที่จับคู่ได้นำเข้าสต็อกร้านเรียบร้อยแล้ว
                </span>
              )}
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">รายการ</th>
                    <th className="py-2.5 px-2 text-center w-20">จำนวน</th>
                    <th className="py-2.5 px-2 text-right w-24">ราคา/หน่วย</th>
                    <th className="py-2.5 px-3 text-right w-28">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {doc.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        {item.matchedProductName && (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="size-3" /> จับคู่กับ: {item.matchedProductName}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-muted-foreground">
                        ฿{item.unitPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        ฿{item.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="rounded-xl h-9 text-xs gap-1.5"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" /> ลบเอกสาร
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl h-9 text-xs"
              onClick={onClose}
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ORIGINAL RECEIPT LIGHTBOX */}
      {imagePreviewOpen && doc.originalImageUrl && (
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] p-4 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" /> ภาพถ่ายบิลต้นฉบับ ({doc.docNumber})
              </DialogTitle>
            </DialogHeader>
            <div className="rounded-xl overflow-hidden border bg-muted/40 max-h-[75vh] flex items-center justify-center p-2">
              <img
                src={doc.originalImageUrl}
                alt={`Receipt ${doc.docNumber}`}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
            <DialogFooter className="flex justify-between items-center">
              <a
                href={doc.originalImageUrl}
                download={`receipt_${doc.docNumber}.jpg`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-background text-foreground text-xs font-semibold hover:bg-muted"
              >
                <Download className="size-3.5 text-primary" /> ดาวน์โหลดภาพ
              </a>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setImagePreviewOpen(false)}
              >
                ปิดหน้าต่าง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
