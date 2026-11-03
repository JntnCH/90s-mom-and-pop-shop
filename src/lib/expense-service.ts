/**
 * Expense & Purchase Receipt Service
 * Manages receipts, invoices, duplicate detection, and stock updates for
 * โชห่วยยุค90s store.
 */

import { MasterStore, type ProductItem } from "./store";

export type ExpenseDocType = "PURCHASE_GOODS" | "GENERAL_EXPENSE";

export type ExpenseCategory =
  | "ซื้อสินค้าเข้าร้าน"
  | "ค่าไฟฟ้า"
  | "ค่าน้ำประปา"
  | "ค่าเช่าสถานที่"
  | "ค่าอินเทอร์เน็ตและโทรศัพท์"
  | "วัสดุสิ้นเปลืองและบรรจุภัณฑ์"
  | "ค่าขนส่งและโลจิสติกส์"
  | "ค่าซ่อมแซมและบำรุงรักษา"
  | "ค่าจ้างและแรงงาน"
  | "ค่าธรรมเนียมและภาษี"
  | "ค่าใช้จ่ายทั่วไปอื่นๆ";

export interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount?: number;
  total: number;
  // Stock integration fields (Only applicable for PURCHASE_GOODS)
  matchedProductId?: string;
  matchedProductName?: string;
  matchedProductBarcode?: string;
  shouldUpdateStock?: boolean;
  shouldUpdateCostPrice?: boolean;
}

export interface ExpenseDocument {
  id: string;
  docType: ExpenseDocType;
  docNumber: string;
  docDate: string; // YYYY-MM-DD
  merchantName: string;
  merchantTaxId?: string;
  merchantBranch?: string;
  merchantAddress?: string;
  merchantPhone?: string;
  category: ExpenseCategory | string;
  items: ExpenseItem[];
  subtotal: number;
  discountTotal: number;
  vatAmount: number;
  grandTotal: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "PROMPTPAY" | "CREDIT_CARD" | "OTHER";
  paymentStatus: "PAID" | "PENDING";
  note?: string;
  originalImageUrl?: string; // Stored image (data URL / thumbnail)
  isStockUpdated: boolean; // True if inventory stock was credited
  stockReceivedAt?: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_EXPENSES = "minimark_expense_documents_v2";

export const DEFAULT_EXPENSE_CATEGORIES: {
  category: ExpenseCategory;
  type: ExpenseDocType;
  description: string;
}[] = [
  {
    category: "ซื้อสินค้าเข้าร้าน",
    type: "PURCHASE_GOODS",
    description: "บิลซื้อสินค้า ขนม เครื่องดื่ม เพื่อวางจำหน่าย (เพิ่มสต็อก)",
  },
  {
    category: "ค่าไฟฟ้า",
    type: "GENERAL_EXPENSE",
    description: "บิลค่าไฟฟ้าการไฟฟ้านครหลวง / ส่วนภูมิภาค (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าน้ำประปา",
    type: "GENERAL_EXPENSE",
    description: "บิลค่าน้ำประปาการประปานครหลวง / ส่วนภูมิภาค (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าเช่าสถานที่",
    type: "GENERAL_EXPENSE",
    description: "ค่าเช่าพื้นที่ร้าน ตึกแถว แผงค้า (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าอินเทอร์เน็ตและโทรศัพท์",
    type: "GENERAL_EXPENSE",
    description: "ค่าบริการสัญญาณอินเทอร์เน็ต POS และโทรศัพท์ (ไม่เพิ่มสต็อก)",
  },
  {
    category: "วัสดุสิ้นเปลืองและบรรจุภัณฑ์",
    type: "GENERAL_EXPENSE",
    description: "ถุงพลาสติกหูหิ้ว เทปกาว กระดาษพิมพ์ใบเสร็จ (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าขนส่งและโลจิสติกส์",
    type: "GENERAL_EXPENSE",
    description: "ค่ารถส่งของ ค่าน้ำมันรถขนส่งสินค้า (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าซ่อมแซมและบำรุงรักษา",
    type: "GENERAL_EXPENSE",
    description: "ค่าช่างซ่อมตู้แช่ ซ่อมไฟ ซ่อมเครื่องปรับอากาศ (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าจ้างและแรงงาน",
    type: "GENERAL_EXPENSE",
    description: "ค่าจ้างรายวัน/เงินเดือนพนักงานหน้าร้าน (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าธรรมเนียมและภาษี",
    type: "GENERAL_EXPENSE",
    description: "ค่าธรรมเนียมใบอนุญาตขายสุรา ยาสูบ ภาษีป้าย (ไม่เพิ่มสต็อก)",
  },
  {
    category: "ค่าใช้จ่ายทั่วไปอื่นๆ",
    type: "GENERAL_EXPENSE",
    description: "ค่าใช้จ่ายเบ็ดเตล็ดประจำวันของร้าน (ไม่เพิ่มสต็อก)",
  },
];

class ExpenseServiceManager {
  private expenses: ExpenseDocument[] = [];
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_EXPENSES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Permanently strip any sample/demo expenses
          this.expenses = parsed.filter(
            (e: ExpenseDocument) => e && e.id && !e.id.startsWith("exp_sample_"),
          );
          if (this.expenses.length !== parsed.length) {
            this.saveToStorage();
          }
        } else {
          this.expenses = [];
        }
      } else {
        this.expenses = [];
      }
      this.isLoaded = true;
    } catch {
      this.expenses = [];
      this.isLoaded = true;
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(this.expenses));
      window.dispatchEvent(new Event("minimark_store_change"));
      window.dispatchEvent(new Event("minimark_expenses_change"));
    } catch (e) {
      console.warn("Expense storage warning:", e);
    }
  }

  private ensureLoaded() {
    if (!this.isLoaded) {
      this.loadFromStorage();
    }
  }

  public getExpenses(): ExpenseDocument[] {
    this.ensureLoaded();
    return [...this.expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getExpenseById(id: string): ExpenseDocument | undefined {
    this.ensureLoaded();
    return this.expenses.find((e) => e.id === id);
  }

  /**
   * Check for duplicate document number from the same merchant/issuer
   */
  public checkDuplicateDoc(
    docNumber: string,
    merchantName?: string,
    excludeId?: string,
  ): { isDuplicate: boolean; existingDoc?: ExpenseDocument } {
    this.ensureLoaded();
    const cleanNum = docNumber.trim().toLowerCase();
    if (!cleanNum) return { isDuplicate: false };

    const cleanMerchant = (merchantName || "").trim().toLowerCase();

    const existing = this.expenses.find((e) => {
      if (excludeId && e.id === excludeId) return false;
      const numMatch = e.docNumber.trim().toLowerCase() === cleanNum;
      if (!numMatch) return false;

      // If merchant is provided on both, require merchant match as well
      if (cleanMerchant && e.merchantName) {
        return (
          e.merchantName.trim().toLowerCase() === cleanMerchant ||
          e.merchantName.trim().toLowerCase().includes(cleanMerchant) ||
          cleanMerchant.includes(e.merchantName.trim().toLowerCase())
        );
      }
      return true;
    });

    return {
      isDuplicate: Boolean(existing),
      existingDoc: existing,
    };
  }

  /**
   * Find product match suggestion for an OCR line item
   */
  public findBestProductMatch(itemName: string, barcode?: string): ProductItem | undefined {
    const products = MasterStore.getProducts();

    // 1. Exact Barcode Match
    if (barcode && barcode.trim()) {
      const matchBarcode = products.find((p) => p.barcode === barcode.trim());
      if (matchBarcode) return matchBarcode;
    }

    // 2. Exact or substring Name Match
    const cleanItemName = itemName.trim().toLowerCase();
    if (!cleanItemName) return undefined;

    // Check exact name
    const exactName = products.find((p) => p.name.trim().toLowerCase() === cleanItemName);
    if (exactName) return exactName;

    // Check words overlap
    const words = cleanItemName.split(/\s+/).filter((w) => w.length >= 2);
    let bestScore = 0;
    let bestProduct: ProductItem | undefined;

    for (const prod of products) {
      const pName = prod.name.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (pName.includes(w)) score += 1;
      }
      if (score > bestScore && score >= 1) {
        bestScore = score;
        bestProduct = prod;
      }
    }

    return bestProduct;
  }

  /**
   * Create new Expense Document and optionally link to Stock if it's PURCHASE_GOODS
   */
  public createExpense(
    doc: Omit<ExpenseDocument, "id" | "createdAt" | "updatedAt">,
    options?: {
      creditToStock?: boolean;
      updateCostPrice?: boolean;
    },
  ): { expense: ExpenseDocument; stockItemsUpdated: number } {
    this.ensureLoaded();
    const now = new Date().toISOString();
    const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let stockItemsUpdated = 0;
    const shouldCredit = options?.creditToStock ?? doc.docType === "PURCHASE_GOODS";

    // Only apply stock updates if the document type is PURCHASE_GOODS
    if (doc.docType === "PURCHASE_GOODS" && shouldCredit) {
      doc.items.forEach((item) => {
        if (item.shouldUpdateStock !== false && item.matchedProductId && item.quantity > 0) {
          // 1. Credit Stock
          const res = MasterStore.receiveStock(
            item.matchedProductId,
            item.quantity,
            doc.operator || "พนักงานบันทึกบิล",
            `รับสินค้าเข้าจากบิลซื้อสินค้าเลขที่ ${doc.docNumber} (${doc.merchantName})`,
            item.name,
          );

          if (res.success) {
            stockItemsUpdated++;

            // 2. Update Cost Price if requested
            if ((options?.updateCostPrice || item.shouldUpdateCostPrice) && item.unitPrice > 0) {
              const prod = MasterStore.getProducts().find((p) => p.id === item.matchedProductId);
              if (prod) {
                MasterStore.updateProduct(prod.id, {
                  costPrice: item.unitPrice,
                });
              }
            }
          }
        }
      });
    }

    const newDoc: ExpenseDocument = {
      ...doc,
      id,
      isStockUpdated: stockItemsUpdated > 0,
      stockReceivedAt: stockItemsUpdated > 0 ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.expenses.unshift(newDoc);
    this.saveToStorage();

    return { expense: newDoc, stockItemsUpdated };
  }

  /**
   * Update existing expense document
   */
  public updateExpense(id: string, updates: Partial<ExpenseDocument>): ExpenseDocument | null {
    this.ensureLoaded();
    const idx = this.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    const existing = this.expenses[idx];
    if (!existing) return null;

    const updated: ExpenseDocument = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.expenses[idx] = updated;
    this.saveToStorage();
    return updated;
  }

  /**
   * Delete expense document
   */
  public deleteExpense(id: string): boolean {
    this.ensureLoaded();
    const initialLen = this.expenses.length;
    this.expenses = this.expenses.filter((e) => e.id !== id);
    if (this.expenses.length !== initialLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Export Expense List to CSV
   */
  public exportToCsv(filteredList?: ExpenseDocument[]): void {
    const list = filteredList || this.getExpenses();
    const rows: string[] = [];

    // Header
    rows.push(`"รายงานบันทึกรายจ่าย & บิลซื้อสินค้า - โชห่วยยุค90s"`);
    rows.push(`"วันที่ส่งออก:", "${new Date().toLocaleString("th-TH")}"`);
    rows.push(`"จำนวนเอกสาร:", "${list.length} ฉบับ"`);
    rows.push(`""`);

    rows.push(
      `"ลำดับ","ประเภทเอกสาร","เลขที่เอกสาร","วันที่เอกสาร","ชื่อร้านค้า/ซัพพลายเออร์","เลขประจำตัวผู้เสียภาษี","หมวดหมู่","ยอดก่อนภาษี","ส่วนลด","VAT","ยอดสุทธิ","วิธีชำระ","สถานะสต็อก","ผู้บันทึก"`,
    );

    list.forEach((e, idx) => {
      const typeLabel =
        e.docType === "PURCHASE_GOODS" ? "บิลซื้อสินค้าเข้าร้าน" : "บิลค่าใช้จ่ายทั่วไป";
      const stockLabel = e.isStockUpdated ? "เพิ่มสต็อกแล้ว" : "ไม่กระทบสต็อก";

      rows.push(
        `"${idx + 1}","${typeLabel}","${e.docNumber}","${e.docDate}","${(e.merchantName || "").replace(/"/g, '""')}","${e.merchantTaxId || "-"}","${e.category}","${e.subtotal.toFixed(2)}","${e.discountTotal.toFixed(2)}","${e.vatAmount.toFixed(2)}","${e.grandTotal.toFixed(2)}","${e.paymentMethod}","${stockLabel}","${e.operator || "-"}"`,
      );
    });

    const csvContent = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minimark_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all stored expenses
   */
  public clearAllExpenses(): void {
    this.expenses = [];
    this.saveToStorage();
  }
}

export const expenseService = new ExpenseServiceManager();
