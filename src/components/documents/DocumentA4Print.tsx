import {
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
  Printer,
  QrCode,
  Share2,
  User,
  X,
} from "lucide-react";
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type SalesDocument,
  type CompanyInfo,
  DEFAULT_COMPANY_INFO,
} from "@/lib/sales-document-service";

interface DocumentA4PrintProps {
  document: SalesDocument;
  company?: CompanyInfo;
  onClose?: () => void;
}

export function DocumentA4Print({
  document: doc,
  company = DEFAULT_COMPANY_INFO,
  onClose,
}: DocumentA4PrintProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const getDocTitle = () => {
    switch (doc.type) {
      case "QUOTATION":
        return {
          th: "ใบเสนอราคา",
          en: "QUOTATION",
          color: "border-sky-500 text-sky-700 bg-sky-50",
        };
      case "BILLING_INVOICE":
        return {
          th: "ใบแจ้งหนี้ / ใบวางบิล",
          en: "INVOICE / BILLING NOTE",
          color: "border-indigo-500 text-indigo-700 bg-indigo-50",
        };
      case "TAX_INVOICE_RECEIPT":
        return {
          th: "ใบเสร็จรับเงิน / ใบกำกับภาษี",
          en: "RECEIPT / TAX INVOICE",
          color: "border-emerald-600 text-emerald-800 bg-emerald-50",
        };
      case "CREDIT_NOTE":
        return {
          th: "ใบลดหนี้ / ใบกำกับภาษี",
          en: "CREDIT NOTE",
          color: "border-rose-500 text-rose-700 bg-rose-50",
        };
    }
  };

  const titleInfo = getDocTitle();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-6">
      {/* Top Action Bar */}
      <div className="sticky top-2 z-20 w-full max-w-4xl bg-background/95 backdrop-blur border border-border shadow-lg rounded-2xl p-3 mb-4 flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 font-semibold">
            {doc.docNumber}
          </Badge>
          <span className="text-sm font-medium hidden sm:inline text-muted-foreground">
            {titleInfo.th} ({titleInfo.en})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-xl font-medium"
            onClick={handlePrint}
          >
            <Printer className="size-4 text-primary" /> พิมพ์เอกสาร A4
          </Button>
          {onClose && (
            <Button size="icon" variant="ghost" className="rounded-full size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* A4 Paper Container */}
      <div
        ref={printAreaRef}
        className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl rounded-xl border border-slate-200 p-6 sm:p-10 text-xs sm:text-sm font-sans print:shadow-none print:border-none print:m-0 print:p-4 print:w-full print:max-w-none print:rounded-none"
        style={{ minHeight: "297mm" }}
      >
        {/* Document Header (Company & Title) */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6">
          {/* Company Info (Left) */}
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                M
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">{company.name}</h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  {company.branchType === "HEAD_OFFICE"
                    ? "สำนักงานใหญ่ (Head Office)"
                    : `สาขาที่ ${company.branchCode}`}
                </p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed text-[11px] sm:text-xs">
              {company.address}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-1">
              <span>
                <strong>เลขประจำตัวผู้เสียภาษี:</strong> {company.taxId}
              </span>
              <span>
                <strong>โทร:</strong> {company.phone}
              </span>
              <span>
                <strong>อีเมล:</strong> {company.email}
              </span>
            </div>
          </div>

          {/* Document Title & Meta (Right) */}
          <div className="w-full sm:w-auto text-left sm:text-right space-y-2">
            <div
              className={`border-2 rounded-xl px-4 py-2 text-center sm:text-right shadow-sm ${titleInfo.color}`}
            >
              <h2 className="text-base sm:text-lg font-extrabold leading-tight">{titleInfo.th}</h2>
              <p className="text-[10px] font-bold tracking-widest opacity-85">{titleInfo.en}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] space-y-1 text-slate-700">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">เลขที่เอกสาร:</span>
                <strong className="font-mono text-slate-900">{doc.docNumber}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">วันที่ออก:</span>
                <span>{doc.issueDate}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">วันครบกำหนด:</span>
                <span className="font-semibold text-rose-600">{doc.dueDate}</span>
              </div>
              {doc.creditDays > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">เครดิต (วัน):</span>
                  <span>{doc.creditDays} วัน</span>
                </div>
              )}
              {doc.referenceDocNumber && (
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-1">
                  <span className="text-slate-500">อ้างอิง:</span>
                  <span className="font-mono font-medium">{doc.referenceDocNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Information Box */}
        <div className="my-5 p-4 rounded-xl bg-slate-50/80 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              ข้อมูลลูกค้า / ผู้ซื้อ
            </span>
            <h3 className="font-bold text-slate-900 text-sm">{doc.customer.name}</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">{doc.customer.address}</p>
            {doc.customer.contactPerson && (
              <p className="text-[11px] text-slate-600">
                <strong>ผู้ติดต่อ:</strong> {doc.customer.contactPerson}
              </p>
            )}
          </div>

          <div className="space-y-1 sm:text-right flex flex-col justify-end text-[11px] text-slate-700">
            <div>
              <span className="text-slate-500">เลขประจำตัวผู้เสียภาษี: </span>
              <strong>{doc.customer.taxId || "บุคคลธรรมดา / ไม่ระบุ"}</strong>
            </div>
            <div>
              <span className="text-slate-500">สถานประกอบการ: </span>
              <span>
                {doc.customer.branchType === "HEAD_OFFICE"
                  ? "สำนักงานใหญ่ (00000)"
                  : `สาขาที่ ${doc.customer.branchCode || "-"}`}
              </span>
            </div>
            {doc.customer.phone && (
              <div>
                <span className="text-slate-500">เบอร์โทรศัพท์: </span>
                <span>{doc.customer.phone}</span>
              </div>
            )}
            {doc.customer.email && (
              <div>
                <span className="text-slate-500">อีเมล: </span>
                <span>{doc.customer.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto my-4 border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">รายละเอียดสินค้า / บริการ</th>
                <th className="py-2.5 px-3 w-20 text-center">จำนวน</th>
                <th className="py-2.5 px-3 w-16 text-center">หน่วย</th>
                <th className="py-2.5 px-3 w-24 text-right">ราคา/หน่วย</th>
                <th className="py-2.5 px-3 w-20 text-right">ส่วนลด</th>
                <th className="py-2.5 px-3 w-28 text-right">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {doc.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    {item.barcode && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        บาร์โค้ด: {item.barcode}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center font-medium">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center text-slate-600">{item.unit}</td>
                  <td className="py-2 px-3 text-right font-mono">
                    {item.unitPrice.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-500">
                    {item.discountAmount && item.discountAmount > 0
                      ? item.discountAmount.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                    {item.total.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation Summary & Thai Baht Box */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 my-4">
          {/* Thai Baht Text Box & Payment Notes (Left - 7 cols) */}
          <div className="sm:col-span-7 space-y-3 flex flex-col justify-between">
            {/* Thai Baht Box */}
            <div className="bg-slate-100/90 border border-slate-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                จำนวนเงินตัวอักษร (Amount in Thai Baht)
              </span>
              <p className="font-bold text-slate-900 text-xs sm:text-sm">
                {doc.calculation.thaiBahtText}
              </p>
            </div>

            {/* Payment / Bank Account info */}
            <div className="border border-slate-200 rounded-lg p-3 bg-white text-[11px] space-y-1 text-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <CreditCard className="size-3.5 text-emerald-600" /> ข้อมูลการชำระเงิน
              </div>
              <p>{company.bankAccountInfo}</p>
              {company.promptPayNumber && (
                <p>
                  <strong>พร้อมเพย์ (PromptPay):</strong> {company.promptPayNumber}
                </p>
              )}
              {doc.notes && (
                <p className="text-slate-600 pt-1 border-t border-slate-100">
                  <strong>หมายเหตุ:</strong> {doc.notes}
                </p>
              )}
            </div>
          </div>

          {/* Totals Breakdown (Right - 5 cols) */}
          <div className="sm:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">รวมเป็นเงิน (Subtotal):</span>
              <span className="font-mono">
                {doc.calculation.subtotal.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {doc.calculation.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>ส่วนลดรวม (Discount):</span>
                <span className="font-mono">
                  -
                  {doc.calculation.discountTotal.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-1">
              <span className="text-slate-500">ราคาหลังหักส่วนลด:</span>
              <span className="font-mono">
                {doc.calculation.afterDiscount.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>
                ภาษีมูลค่าเพิ่ม VAT {doc.calculation.vatRate}%{" "}
                <span className="text-[10px]">
                  (
                  {doc.calculation.vatType === "INCLUDED"
                    ? "รวมใน"
                    : doc.calculation.vatType === "EXCLUDED"
                      ? "แยกนอก"
                      : "ยกเว้น"}
                  )
                </span>
                :
              </span>
              <span className="font-mono">
                {doc.calculation.vatAmount.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1.5 text-sm">
              <span>จำนวนเงินรวมทั้งสิ้น:</span>
              <span className="font-mono text-emerald-700">
                ฿
                {doc.calculation.grandTotal.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {doc.calculation.withholdingTaxAmount > 0 && (
              <div className="flex justify-between text-rose-600 text-xs border-t border-dashed border-slate-200 pt-1">
                <span>หัก ณ ที่จ่าย ({doc.calculation.withholdingTaxRate}%):</span>
                <span className="font-mono">
                  -
                  {doc.calculation.withholdingTaxAmount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            {doc.calculation.withholdingTaxAmount > 0 && (
              <div className="flex justify-between font-extrabold text-slate-900 bg-emerald-50/80 p-1.5 rounded border border-emerald-200 text-sm">
                <span>ยอดชำระสุทธิ:</span>
                <span className="font-mono text-emerald-800">
                  ฿
                  {doc.calculation.netPaymentAmount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Signature Authorization Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-700">
          {/* Customer / Receiver */}
          <div className="p-3 border border-slate-200 rounded-lg space-y-8 bg-slate-50/50">
            <p className="font-medium text-slate-600">ผู้รับเอกสาร / ผู้ซื้อ</p>
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1"></div>
              <p className="text-[10px] text-slate-500">( วันที่: _____/_____/_________ )</p>
            </div>
          </div>

          {/* Sales / Issuer */}
          <div className="p-3 border border-slate-200 rounded-lg space-y-8 bg-slate-50/50">
            <p className="font-medium text-slate-600">ผู้จัดทำเอกสาร</p>
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1">
                <span className="text-[11px] text-slate-800 font-medium">
                  {doc.salesPerson || "เจ้าหน้าที่การเงิน"}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">( วันที่: {doc.issueDate} )</p>
            </div>
          </div>

          {/* Authorizer / Cashier */}
          <div className="col-span-2 sm:col-span-1 p-3 border border-slate-200 rounded-lg space-y-8 bg-slate-50/50">
            <p className="font-medium text-slate-600">ผู้มีอำนาจลงนาม / ผู้รับเงิน</p>
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-3/4 mx-auto pb-1"></div>
              <p className="text-[10px] text-slate-500">( วันที่: _____/_____/_________ )</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-1">
          <span>ออกเอกสารโดยระบบ โชห่วยยุค90s Cloud ERP & Flow POS</span>
          <span>หน้า 1 จาก 1</span>
        </div>
      </div>
    </div>
  );
}
