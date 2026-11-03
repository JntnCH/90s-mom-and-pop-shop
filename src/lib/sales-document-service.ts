import { thaiBahtText } from "./thai-baht-text";
import { MasterStore } from "./store";

export type DocumentType =
  | "QUOTATION" // ใบเสนอราคา (QT)
  | "BILLING_INVOICE" // ใบแจ้งหนี้ / ใบวางบิล (INV)
  | "TAX_INVOICE_RECEIPT" // ใบเสร็จรับเงิน / ใบกำกับภาษี (TAX/RC)
  | "CREDIT_NOTE"; // ใบลดหนี้ (CN)

export type DocumentStatus =
  | "DRAFT" // ร่าง
  | "PENDING" // รอส่ง / รออนุมัติ
  | "APPROVED" // อนุมัติแล้ว
  | "PAID" // ชำระเงินแล้ว
  | "CANCELLED"; // ยกเลิก

export type VatType = "INCLUDED" | "EXCLUDED" | "EXEMPT";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "PROMPTPAY" | "CREDIT_CARD" | "CHEQUE";

export interface CustomerInfo {
  id?: string;
  name: string;
  taxId?: string; // เลขประจำตัวผู้เสียภาษี 13 หลัก
  branchType: "HEAD_OFFICE" | "BRANCH";
  branchCode?: string; // รหัสสาขา เช่น 00000
  address: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
}

export interface DocumentItem {
  id: string;
  productId?: string;
  barcode?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountAmount?: number;
  total: number;
}

export interface DocumentCalculation {
  subtotal: number; // ยอดรวมก่อนส่วนลด
  discountTotal: number; // ส่วนลดรวม
  afterDiscount: number; // ยอดหลังหักส่วนลด
  vatType: VatType;
  vatRate: number; // 7%
  vatAmount: number; // มูลค่าภาษี
  preVatAmount: number; // มูลค่าก่อนภาษี (สำหรับแยกนอก หรือถอดภาษีใน)
  grandTotal: number; // ยอดรวมทั้งสิ้น
  withholdingTaxRate: number; // 0%, 1%, 2%, 3%, 5%
  withholdingTaxAmount: number; // ภาษีหัก ณ ที่จ่าย
  netPaymentAmount: number; // ยอดที่ต้องชำระสุทธิ
  thaiBahtText: string; // ตัวอักษรภาษาไทย
}

export interface SalesDocument {
  id: string;
  docNumber: string; // e.g. QT-202609-001, INV-202609-001, TAX-202609-001
  type: DocumentType;
  status: DocumentStatus;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  creditDays: number; // 0, 7, 15, 30, 60 days
  referenceDocNumber?: string; // เลขที่เอกสารอ้างอิง เช่น QT-202609-001
  referenceDocId?: string;
  customer: CustomerInfo;
  items: DocumentItem[];
  calculation: DocumentCalculation;
  paymentMethod?: PaymentMethod | undefined;
  paymentDate?: string | undefined;
  paymentRef?: string;
  notes?: string;
  termsAndConditions?: string | undefined;
  salesPerson?: string | undefined;
  createdAt: string;
  updatedAt: string;
  stockDeducted?: boolean; // ตัดสต็อกแล้วหรือยัง
}

export interface CompanyInfo {
  name: string;
  taxId: string;
  branchType: "HEAD_OFFICE" | "BRANCH";
  branchCode: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  promptPayNumber?: string;
  bankAccountInfo?: string;
  logoUrl?: string;
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: "บริษัท มินิมาร์ค รีเทล โซลูชั่นส์ จำกัด",
  taxId: "0105566012345",
  branchType: "HEAD_OFFICE",
  branchCode: "00000",
  address: "เลขที่ 123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
  phone: "02-888-9999, 089-123-4567",
  email: "billing@minimark-pos.com",
  website: "www.minimark-pos.com",
  promptPayNumber: "0105566012345",
  bankAccountInfo: "ธนาคารกสิกรไทย เลขที่ 012-3-45678-9 ชื่อบัญชี บจก. มินิมาร์ค รีเทล",
};

const STORAGE_KEY_DOCS = "minimark_sales_documents_v1";
const STORAGE_KEY_COMPANY = "minimark_company_profile_v1";

/**
 * Calculates document financial totals compliant with Thai Revenue Department standards
 */
export function calculateDocumentTotals(
  items: Array<{ quantity: number; unitPrice: number; discountAmount?: number }>,
  vatType: VatType = "INCLUDED",
  vatRate = 7,
  withholdingTaxRate = 0,
  overallDiscount = 0,
): DocumentCalculation {
  let subtotal = 0;
  let itemDiscountSum = 0;

  items.forEach((it) => {
    const qty = Math.max(0, it.quantity || 0);
    const price = Math.max(0, it.unitPrice || 0);
    const disc = Math.max(0, it.discountAmount || 0);
    const lineTotal = Math.max(0, qty * price - disc);
    subtotal += qty * price;
    itemDiscountSum += disc;
  });

  const totalDiscount = itemDiscountSum + overallDiscount;
  const afterDiscount = Math.max(0, subtotal - totalDiscount);

  let preVatAmount = 0;
  let vatAmount = 0;
  let grandTotal = 0;

  if (vatType === "EXCLUDED") {
    preVatAmount = afterDiscount;
    vatAmount = Math.round(((preVatAmount * vatRate) / 100) * 100) / 100;
    grandTotal = preVatAmount + vatAmount;
  } else if (vatType === "INCLUDED") {
    grandTotal = afterDiscount;
    // Extract VAT from inclusive price: Base = Total * 100 / (100 + Rate)
    preVatAmount = Math.round(((grandTotal * 100) / (100 + vatRate)) * 100) / 100;
    vatAmount = Math.round((grandTotal - preVatAmount) * 100) / 100;
  } else {
    // EXEMPT
    preVatAmount = afterDiscount;
    vatAmount = 0;
    grandTotal = afterDiscount;
  }

  const whtAmount =
    withholdingTaxRate > 0
      ? Math.round(((preVatAmount * withholdingTaxRate) / 100) * 100) / 100
      : 0;

  const netPaymentAmount = Math.max(0, grandTotal - whtAmount);
  const bahtText = thaiBahtText(netPaymentAmount || grandTotal);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(totalDiscount * 100) / 100,
    afterDiscount: Math.round(afterDiscount * 100) / 100,
    vatType,
    vatRate,
    vatAmount,
    preVatAmount,
    grandTotal: Math.round(grandTotal * 100) / 100,
    withholdingTaxRate,
    withholdingTaxAmount: whtAmount,
    netPaymentAmount: Math.round(netPaymentAmount * 100) / 100,
    thaiBahtText: bahtText,
  };
}

/**
 * Standard calculation helper for POS and Sales Billing
 */
export function calculateDocument(
  items: Array<{ quantity: number; unitPrice: number; discountAmount?: number }>,
  vatType: VatType = "INCLUDED",
  vatRate = 7,
  overallDiscount = 0,
  withholdingTaxRate = 0,
): DocumentCalculation {
  return calculateDocumentTotals(items, vatType, vatRate, withholdingTaxRate, overallDiscount);
}

class SalesDocumentManager {
  private documents: SalesDocument[] = [];
  private companyInfo: CompanyInfo = DEFAULT_COMPANY_INFO;
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;

    try {
      const rawCompany = localStorage.getItem(STORAGE_KEY_COMPANY);
      if (rawCompany) {
        this.companyInfo = { ...DEFAULT_COMPANY_INFO, ...JSON.parse(rawCompany) };
      }

      const rawDocs = localStorage.getItem(STORAGE_KEY_DOCS);
      if (rawDocs) {
        const parsed = JSON.parse(rawDocs);
        if (Array.isArray(parsed)) {
          // Permanently strip any sample/demo documents
          this.documents = parsed.filter(
            (d: SalesDocument) => d && d.id && !d.id.startsWith("doc_sample_"),
          );
          if (this.documents.length !== parsed.length) {
            this.saveToStorage();
          }
        } else {
          this.documents = [];
        }
      } else {
        this.documents = [];
      }
      this.isLoaded = true;
    } catch {
      this.documents = [];
      this.isLoaded = true;
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(this.documents));
      localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(this.companyInfo));
      window.dispatchEvent(new Event("minimark_store_change"));
    } catch {
      // Ignore quota error
    }
  }

  public getCompanyInfo(): CompanyInfo {
    this.ensureLoaded();
    return this.companyInfo;
  }

  public updateCompanyInfo(info: Partial<CompanyInfo>) {
    this.ensureLoaded();
    this.companyInfo = { ...this.companyInfo, ...info };
    this.saveToStorage();
  }

  public getDocuments(type?: DocumentType): SalesDocument[] {
    this.ensureLoaded();
    if (!type) return [...this.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.documents
      .filter((d) => d.type === type)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getDocumentById(id: string): SalesDocument | undefined {
    this.ensureLoaded();
    return this.documents.find((d) => d.id === id);
  }

  public generateDocNumber(type: DocumentType): string {
    this.ensureLoaded();
    const prefixMap: Record<DocumentType, string> = {
      QUOTATION: "QT",
      BILLING_INVOICE: "INV",
      TAX_INVOICE_RECEIPT: "TAX",
      CREDIT_NOTE: "CN",
    };

    const prefix = prefixMap[type];
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

    const matching = this.documents.filter(
      (d) => d.type === type && d.docNumber.startsWith(`${prefix}-${yearMonth}`),
    );

    const nextSeq = String(matching.length + 1).padStart(3, "0");
    return `${prefix}-${yearMonth}-${nextSeq}`;
  }

  public createDocument(
    doc: Omit<SalesDocument, "id" | "createdAt" | "updatedAt" | "docNumber"> & {
      customDocNumber?: string;
    },
  ): SalesDocument {
    this.ensureLoaded();
    const now = new Date().toISOString();
    const docNumber = doc.customDocNumber || this.generateDocNumber(doc.type);

    const newDoc: SalesDocument = {
      ...doc,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      docNumber,
      createdAt: now,
      updatedAt: now,
    };

    // Auto deduct stock if it's a paid TAX_INVOICE_RECEIPT
    if (
      newDoc.type === "TAX_INVOICE_RECEIPT" &&
      newDoc.status === "PAID" &&
      !newDoc.stockDeducted
    ) {
      this.deductStockForDoc(newDoc);
      newDoc.stockDeducted = true;
    }

    this.documents.unshift(newDoc);
    this.saveToStorage();
    return newDoc;
  }

  public updateDocument(id: string, updates: Partial<SalesDocument>): SalesDocument | null {
    this.ensureLoaded();
    const idx = this.documents.findIndex((d) => d.id === id);
    if (idx === -1) return null;

    const existing = this.documents[idx];
    if (!existing) return null;

    const updated: SalesDocument = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If status changed to PAID and is TAX INVOICE, deduct stock
    if (
      updated.type === "TAX_INVOICE_RECEIPT" &&
      updated.status === "PAID" &&
      !updated.stockDeducted
    ) {
      this.deductStockForDoc(updated);
      updated.stockDeducted = true;
    }

    this.documents[idx] = updated;
    this.saveToStorage();
    return updated;
  }

  public deleteDocument(id: string): boolean {
    this.ensureLoaded();
    const initialLen = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== id);
    if (this.documents.length !== initialLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * FlowAccount-style convert flow:
   * Quotation -> Billing Invoice -> Tax Invoice/Receipt
   */
  public convertDocument(sourceDocId: string, targetType: DocumentType): SalesDocument | null {
    this.ensureLoaded();
    const source = this.getDocumentById(sourceDocId);
    if (!source) return null;

    const newDocNumber = this.generateDocNumber(targetType);
    const now = new Date();
    const issueDate = now.toISOString().slice(0, 10);
    const dueDateObj = new Date(now);
    dueDateObj.setDate(dueDateObj.getDate() + (source.creditDays || 30));
    const dueDate = dueDateObj.toISOString().slice(0, 10);

    const convertedDoc: SalesDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      docNumber: newDocNumber,
      type: targetType,
      status: targetType === "TAX_INVOICE_RECEIPT" ? "PAID" : "PENDING",
      issueDate,
      dueDate,
      creditDays: source.creditDays,
      referenceDocNumber: source.docNumber,
      referenceDocId: source.id,
      customer: { ...source.customer },
      items: source.items.map((it) => ({
        ...it,
        id: `item_${Math.random().toString(36).slice(2, 7)}`,
      })),
      calculation: { ...source.calculation },
      paymentMethod: targetType === "TAX_INVOICE_RECEIPT" ? "BANK_TRANSFER" : undefined,
      paymentDate: targetType === "TAX_INVOICE_RECEIPT" ? issueDate : undefined,
      notes: `แปลงเอกสารจาก ${source.docNumber}`,
      termsAndConditions: source.termsAndConditions,
      salesPerson: source.salesPerson,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      stockDeducted: false,
    };

    if (convertedDoc.type === "TAX_INVOICE_RECEIPT" && convertedDoc.status === "PAID") {
      this.deductStockForDoc(convertedDoc);
      convertedDoc.stockDeducted = true;
    }

    // Update source doc status to APPROVED/PAID
    if (source.type === "QUOTATION") {
      this.updateDocument(source.id, { status: "APPROVED" });
    } else if (source.type === "BILLING_INVOICE" && targetType === "TAX_INVOICE_RECEIPT") {
      this.updateDocument(source.id, { status: "PAID" });
    }

    this.documents.unshift(convertedDoc);
    this.saveToStorage();
    return convertedDoc;
  }

  private deductStockForDoc(doc: SalesDocument) {
    if (typeof window === "undefined") return;
    try {
      doc.items.forEach((it) => {
        if (it.productId && it.quantity > 0) {
          MasterStore.issueStock(
            it.productId,
            it.quantity,
            `ตัดสต็อกอัตโนมัติจากใบกำกับภาษีเลขที่ ${doc.docNumber} (${doc.customer.name})`,
            "AUTO_TAX_INVOICE",
          );
        }
      });
    } catch (e) {
      console.warn("Stock deduction warning:", e);
    }
  }

  private ensureLoaded() {
    if (!this.isLoaded) {
      this.loadFromStorage();
    }
  }

  /**
   * Clear all stored sales documents
   */
  public clearAllDocuments(): void {
    this.documents = [];
    this.saveToStorage();
  }
}

export const salesDocService = new SalesDocumentManager();
