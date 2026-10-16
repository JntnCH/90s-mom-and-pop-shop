/**
 * Thermal Printer Management & ESC/POS Generator (Phase 8)
 * Supports:
 * - Thermal 58mm (32 chars / line, ~384 dots)
 * - Thermal 80mm (48 chars / line, ~576 dots)
 * - A4 Document & Label Printers
 * - ESC/POS Raw Command generation
 * - Browser direct thermal printing with exact CSS page sizing
 */

export type PrinterType = "THERMAL_58MM" | "THERMAL_80MM" | "A4_DOCUMENT" | "LABEL_PRINTER";
export type ConnectionType = "USB" | "BLUETOOTH" | "NETWORK_IP" | "SYSTEM_DEFAULT";
export type PrinterStatus = "ONLINE" | "READY" | "OFFLINE";

export interface PrinterDevice {
  id: string;
  name: string;
  model: string;
  type: PrinterType;
  connection: ConnectionType;
  ipAddress?: string;
  port?: number;
  bluetoothAddress?: string;
  isDefaultReceipt: boolean;
  isDefaultOrder: boolean;
  isDefaultLabel: boolean;
  status: PrinterStatus;
  lastTestPrintAt?: string;
}

export interface ReceiptDesignConfig {
  storeName: string;
  branchName: string;
  taxId: string;
  address: string;
  phone: string;
  headerMessage: string;
  footerMessage: string;
  paperWidth: "58mm" | "80mm";
  showLogo: boolean;
  showBarcode: boolean;
  showPromptPayQR: boolean;
  promptPayId: string;
  showCashierName: boolean;
  lineAccountId: string;
  fontScale: "normal" | "compact";
}

export interface ReceiptItemData {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitName?: string;
}

export interface ReceiptPrintData {
  receiptNumber: string;
  date: string;
  cashierName: string;
  items: ReceiptItemData[];
  subtotal: number;
  discount: number;
  vatRate: number; // 7%
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: "CASH" | "PROMPTPAY" | "TRANSFER";
}

const STORAGE_KEY_PRINTERS = "minimark_printers_v1";
const STORAGE_KEY_RECEIPT_CONFIG = "minimark_receipt_config_v1";
const STORAGE_KEY_PRINT_JOBS = "minimark_print_jobs_v1";

export type PrintJobType =
  "RECEIPT" | "BARCODE_LABEL" | "SHELF_TAG" | "PURCHASE_ORDER" | "STOCK_REPORT" | "TEST_PRINT";

export type PrintJobStatus = "QUEUED" | "PRINTING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface PrintJobRecord {
  id: string;
  jobTitle: string;
  jobType: PrintJobType;
  printerId: string;
  printerName: string;
  paperSize: string;
  copies: number;
  status: PrintJobStatus;
  createdAt: string;
  completedAt?: string;
  operator: string;
  payloadSummary: string;
  rawHtml?: string;
}

export const DEFAULT_PRINT_JOBS: PrintJobRecord[] = [
  {
    id: "job-101",
    jobTitle: "ใบเสร็จรับเงิน REC-20260925-0089",
    jobType: "RECEIPT",
    printerId: "ptr-thermal-58",
    printerName: "Xprinter XP-58IIH (เคาน์เตอร์ 1)",
    paperSize: "58mm",
    copies: 1,
    status: "COMPLETED",
    createdAt: "2026-09-25 14:45 น.",
    completedAt: "2026-09-25 14:45 น.",
    operator: "แคชเชียร์หน้าร้าน (สมชาย)",
    payloadSummary: "4 รายการ • ยอดสุทธิ ฿110.00 • เงินสด",
  },
  {
    id: "job-102",
    jobTitle: "ป้ายราคาติดชั้นวาง (Shelf Tags) 4 รายการ",
    jobType: "SHELF_TAG",
    printerId: "ptr-thermal-58",
    printerName: "Xprinter XP-58IIH (เคาน์เตอร์ 1)",
    paperSize: "50x30mm",
    copies: 8,
    status: "COMPLETED",
    createdAt: "2026-09-25 15:30 น.",
    completedAt: "2026-09-25 15:31 น.",
    operator: "พนักงานสต็อก (Staff Store)",
    payloadSummary: "มาม่า, โค้ก, เลย์, เนสกาแฟ (รวม 8 ดวง)",
  },
  {
    id: "job-103",
    jobTitle: "ใบสั่งซื้อสินค้า PO-20260924-001 (A4)",
    jobType: "PURCHASE_ORDER",
    printerId: "ptr-canon-a4",
    printerName: "Canon PIXMA G3010 (เอกสาร PO / สต็อก)",
    paperSize: "A4",
    copies: 2,
    status: "COMPLETED",
    createdAt: "2026-09-25 16:15 น.",
    completedAt: "2026-09-25 16:16 น.",
    operator: "ผู้จัดการร้าน",
    payloadSummary: "ซัพพลายเออร์: ยูนิลีเวอร์ • ยอดทุน ฿468.00",
  },
];

export const DEFAULT_RECEIPT_CONFIG: ReceiptDesignConfig = {
  storeName: "โชห่วยยุค90s",
  branchName: "สาขา 0001 (หน้าร้านพัฒนาการ)",
  taxId: "0105562098765",
  address: "123/45 ถนนพัฒนาการ แขวงสวนหลวง กรุงเทพฯ 10250",
  phone: "02-123-4567, 081-987-6543",
  headerMessage: "ยินดีต้อนรับสู่ โชห่วยยุค90s สินค้าคุณภาพ ราคากันเอง",
  footerMessage: "ขอบคุณที่ใช้บริการ โชห่วยยุค90s โอกาสหน้าเชิญใหม่ครับ",
  paperWidth: "58mm",
  showLogo: true,
  showBarcode: true,
  showPromptPayQR: true,
  promptPayId: "0819876543",
  showCashierName: true,
  lineAccountId: "@minimark",
  fontScale: "normal",
};

export const DEFAULT_PRINTERS: PrinterDevice[] = [
  {
    id: "ptr-thermal-58",
    name: "Xprinter XP-58IIH (เคาน์เตอร์ 1)",
    model: "Xprinter XP-58IIH",
    type: "THERMAL_58MM",
    connection: "USB",
    isDefaultReceipt: true,
    isDefaultOrder: false,
    isDefaultLabel: false,
    status: "ONLINE",
    lastTestPrintAt: "2026-09-24 16:30 น.",
  },
  {
    id: "ptr-thermal-80",
    name: "Epson TM-T82X (แคชเชียร์ 2 / ครัว)",
    model: "Epson TM-T82X",
    type: "THERMAL_80MM",
    connection: "NETWORK_IP",
    ipAddress: "192.168.1.188",
    port: 9100,
    isDefaultReceipt: false,
    isDefaultOrder: true,
    isDefaultLabel: false,
    status: "READY",
    lastTestPrintAt: "2026-09-25 11:20 น.",
  },
  {
    id: "ptr-canon-a4",
    name: "Canon PIXMA G3010 (เอกสาร PO / สต็อก)",
    model: "Canon PIXMA G3010 Ink Tank",
    type: "A4_DOCUMENT",
    connection: "SYSTEM_DEFAULT",
    isDefaultReceipt: false,
    isDefaultOrder: false,
    isDefaultLabel: false,
    status: "ONLINE",
  },
];

export const PrinterService = {
  getPrinters(): PrinterDevice[] {
    if (typeof window === "undefined") return DEFAULT_PRINTERS;
    try {
      const data = localStorage.getItem(STORAGE_KEY_PRINTERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(DEFAULT_PRINTERS));
        return DEFAULT_PRINTERS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_PRINTERS;
    }
  },

  savePrinter(printer: Omit<PrinterDevice, "id"> & { id?: string }): PrinterDevice {
    const list = this.getPrinters();
    let saved: PrinterDevice;

    if (printer.id) {
      saved = { ...printer, id: printer.id } as PrinterDevice;
      const index = list.findIndex((p) => p.id === printer.id);
      if (index >= 0) {
        list[index] = saved;
      } else {
        list.push(saved);
      }
    } else {
      saved = {
        ...printer,
        id: `ptr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      } as PrinterDevice;
      list.push(saved);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_printers_change"));
    }
    return saved;
  },

  deletePrinter(id: string): boolean {
    const list = this.getPrinters().filter((p) => p.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_printers_change"));
    }
    return true;
  },

  setDefaultPrinter(id: string, target: "receipt" | "order" | "label"): void {
    const list = this.getPrinters().map((p) => {
      if (target === "receipt") {
        return { ...p, isDefaultReceipt: p.id === id };
      }
      if (target === "order") {
        return { ...p, isDefaultOrder: p.id === id };
      }
      if (target === "label") {
        return { ...p, isDefaultLabel: p.id === id };
      }
      return p;
    });

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_printers_change"));
    }
  },

  updateTestPrintTime(id: string): void {
    const now =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH") + " น.";
    const list = this.getPrinters().map((p) => (p.id === id ? { ...p, lastTestPrintAt: now } : p));
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_printers_change"));
    }
  },

  getReceiptConfig(): ReceiptDesignConfig {
    if (typeof window === "undefined") return DEFAULT_RECEIPT_CONFIG;
    try {
      const data = localStorage.getItem(STORAGE_KEY_RECEIPT_CONFIG);
      const explicitName = localStorage.getItem("minimark_store_name");
      const cfg = data
        ? { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(data) }
        : DEFAULT_RECEIPT_CONFIG;
      if (explicitName && explicitName.trim()) {
        cfg.storeName = explicitName.trim();
      } else if (
        cfg.storeName === "ร้าน โชห่วยยุค 90s" ||
        cfg.storeName === "MiniMark" ||
        cfg.storeName === "ร้าน MiniMark" ||
        cfg.storeName === "ร้าน MiniMark (มินิมาร์ท โชว์ห่วย)"
      ) {
        cfg.storeName = DEFAULT_RECEIPT_CONFIG.storeName;
      }
      return cfg;
    } catch {
      return DEFAULT_RECEIPT_CONFIG;
    }
  },

  saveReceiptConfig(config: Partial<ReceiptDesignConfig>): ReceiptDesignConfig {
    const current = this.getReceiptConfig();
    const updated = { ...current, ...config };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_RECEIPT_CONFIG, JSON.stringify(updated));
      window.dispatchEvent(new Event("minimark_receipt_config_change"));
    }
    return updated;
  },

  /**
   * Generates standard ESC/POS raw hex/text commands for direct network/serial thermal printers
   */
  generateESCPOS(receipt: ReceiptPrintData, config: ReceiptDesignConfig): string {
    const ESC = "\x1B";
    const GS = "\x1D";
    let cmd = "";

    // 1. Initialize Printer
    cmd += `${ESC}@`; // ESC @: Initialize

    // 2. Center Align & Store Header
    cmd += `${ESC}a\x01`; // Align Center
    cmd += `${ESC}E\x01`; // Bold On
    cmd += `${config.storeName}\n`;
    cmd += `${ESC}E\x00`; // Bold Off
    cmd += `${config.branchName}\n`;
    cmd += `เลขประจำตัวผู้เสียภาษี: ${config.taxId}\n`;
    cmd += `${config.address}\n`;
    cmd += `โทร: ${config.phone}\n`;
    cmd += `--------------------------------\n`;

    // 3. Receipt Details
    cmd += `${ESC}a\x00`; // Align Left
    cmd += `เลขที่ใบเสร็จ: ${receipt.receiptNumber}\n`;
    cmd += `วันที่: ${receipt.date}\n`;
    if (config.showCashierName) {
      cmd += `แคชเชียร์: ${receipt.cashierName}\n`;
    }
    cmd += `================================\n`;

    // 4. Line Items
    cmd += `รายการสินค้า         จำนวน    ยอดรวม\n`;
    cmd += `--------------------------------\n`;
    receipt.items.forEach((item) => {
      const name =
        item.name.length > 16 ? item.name.substring(0, 16) + ".." : item.name.padEnd(18, " ");
      const qty = item.quantity.toString().padStart(3, " ");
      const price = item.total.toFixed(2).padStart(8, " ");
      cmd += `${name} ${qty} ${price}\n`;
    });
    cmd += `--------------------------------\n`;

    // 5. Totals
    cmd += `${ESC}a\x02`; // Align Right
    cmd += `ยอดรวมสินค้า: ฿${receipt.subtotal.toFixed(2)}\n`;
    if (receipt.discount > 0) {
      cmd += `ส่วนลด: -฿${receipt.discount.toFixed(2)}\n`;
    }
    cmd += `VAT (7%): ฿${receipt.vatAmount.toFixed(2)}\n`;
    cmd += `${ESC}E\x01`; // Bold On
    cmd += `ยอดสุทธิ: ฿${receipt.grandTotal.toFixed(2)}\n`;
    cmd += `${ESC}E\x00`; // Bold Off
    cmd += `รับเงิน (${receipt.paymentMethod}): ฿${receipt.paidAmount.toFixed(2)}\n`;
    cmd += `เงินทอน: ฿${receipt.changeAmount.toFixed(2)}\n`;

    // 6. Footer
    cmd += `${ESC}a\x01`; // Align Center
    cmd += `================================\n`;
    cmd += `${config.footerMessage}\n`;
    cmd += `LINE: ${config.lineAccountId}\n`;

    // 7. Cut Paper & Beep
    cmd += `\n\n\n`; // Feed 3 lines
    cmd += `${GS}V\x41\x00`; // GS V 65 0: Full Cut
    cmd += `${ESC}B\x02\x02`; // Beep 2 times

    return cmd;
  },

  /**
   * Browser Direct Print for Thermal Paper (58mm or 80mm)
   */
  printReceiptDirect(receiptHtml: string, paperWidth: "58mm" | "80mm" = "58mm") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const widthMm = paperWidth === "80mm" ? "80mm" : "58mm";
    const contentWidth = paperWidth === "80mm" ? "72mm" : "48mm";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Thermal Receipt Print - โชห่วยยุค90s</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: ${widthMm} auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace, 'Noto Sans Thai', sans-serif;
              width: ${contentWidth};
              margin: 0 auto;
              padding: 2mm 0;
              color: #000000;
              background: #ffffff;
              font-size: 11px;
              line-height: 1.25;
            }
            * {
              box-sizing: border-box;
            }
            hr {
              border: none;
              border-top: 1px dashed #000;
              margin: 4px 0;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .flex-between {
              display: flex;
              justify-content: space-between;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 2px 0;
            }
            @media print {
              body {
                width: ${contentWidth};
              }
            }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 1500);">
          ${receiptHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  },

  /**
   * PHASE 9: Direct Print for Barcode Labels & Shelf Tags
   */
  printLabelsDirect(labelsHtml: string, templateType: LabelTemplateType) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    let pageSizeCss = "@page { size: auto; margin: 5mm; }";
    let bodyStyle = "";

    if (templateType === "PRODUCT_STICKER_30x20") {
      pageSizeCss = "@page { size: 32mm 22mm; margin: 0; }";
      bodyStyle = "width: 32mm; margin: 0; padding: 1mm;";
    } else if (templateType === "PRODUCT_STICKER_40x30") {
      pageSizeCss = "@page { size: 40mm 30mm; margin: 0; }";
      bodyStyle = "width: 40mm; margin: 0; padding: 1.5mm;";
    } else if (templateType === "SHELF_TAG_50x30") {
      pageSizeCss = "@page { size: 50mm 30mm; margin: 0; }";
      bodyStyle = "width: 50mm; margin: 0; padding: 1.5mm;";
    } else if (templateType === "SHELF_TAG_70x40") {
      pageSizeCss = "@page { size: 70mm 40mm; margin: 0; }";
      bodyStyle = "width: 70mm; margin: 0; padding: 2mm;";
    } else if (templateType === "A4_GRID_3x8" || templateType === "A4_GRID_4x10") {
      pageSizeCss = "@page { size: A4 portrait; margin: 8mm 6mm; }";
      bodyStyle = "width: 198mm; margin: 0 auto;";
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>พิมพ์สติกเกอร์บาร์โค้ด & ป้ายราคา - โชห่วยยุค90s</title>
          <meta charset="utf-8" />
          <style>
            ${pageSizeCss}
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #000000;
              background: #ffffff;
              ${bodyStyle}
            }
            .page-break {
              page-break-after: always;
            }
            @media print {
              body {
                background: none;
              }
            }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 1500);">
          ${labelsHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  },

  /**
   * PHASE 10: Print Spooler & Queue Management
   */
  getPrintJobs(): PrintJobRecord[] {
    if (typeof window === "undefined") return DEFAULT_PRINT_JOBS;
    try {
      const data = localStorage.getItem(STORAGE_KEY_PRINT_JOBS);
      if (!data) {
        localStorage.setItem(STORAGE_KEY_PRINT_JOBS, JSON.stringify(DEFAULT_PRINT_JOBS));
        return DEFAULT_PRINT_JOBS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_PRINT_JOBS;
    }
  },

  addPrintJob(job: Omit<PrintJobRecord, "id" | "createdAt" | "completedAt">): PrintJobRecord {
    const list = this.getPrintJobs();
    const now =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH") + " น.";
    const newJob: PrintJobRecord = {
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      ...(job.status === "COMPLETED" ? { completedAt: now } : {}),
    };

    const nextList = [newJob, ...list];
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINT_JOBS, JSON.stringify(nextList));
      window.dispatchEvent(new Event("minimark_print_jobs_change"));
    }
    return newJob;
  },

  updateJobStatus(id: string, status: PrintJobStatus): void {
    const now =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH") + " น.";
    const list = this.getPrintJobs().map((j) =>
      j.id === id
        ? {
            ...j,
            status,
            completedAt: status === "COMPLETED" ? now : j.completedAt,
          }
        : j,
    );

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINT_JOBS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_print_jobs_change"));
    }
  },

  clearCompletedJobs(): void {
    const list = this.getPrintJobs().filter((j) => j.status !== "COMPLETED");
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINT_JOBS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_print_jobs_change"));
    }
  },

  deleteJob(id: string): void {
    const list = this.getPrintJobs().filter((j) => j.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PRINT_JOBS, JSON.stringify(list));
      window.dispatchEvent(new Event("minimark_print_jobs_change"));
    }
  },

  reprintJob(id: string): boolean {
    const job = this.getPrintJobs().find((j) => j.id === id);
    if (!job) return false;

    if (job.rawHtml) {
      if (job.jobType === "RECEIPT") {
        this.printReceiptDirect(job.rawHtml, (job.paperSize as "58mm" | "80mm") || "58mm");
      } else {
        this.printLabelsDirect(
          job.rawHtml,
          (job.paperSize as LabelTemplateType) || "SHELF_TAG_50x30",
        );
      }
    }

    // Add a new completed print log for the reprint action
    this.addPrintJob({
      jobTitle: `(พิมพ์ซ้ำ) ${job.jobTitle}`,
      jobType: job.jobType,
      printerId: job.printerId,
      printerName: job.printerName,
      paperSize: job.paperSize,
      copies: job.copies,
      status: "COMPLETED",
      operator: "ผู้ใช้งาน (Reprint)",
      payloadSummary: job.payloadSummary,
      ...(job.rawHtml !== undefined ? { rawHtml: job.rawHtml } : {}),
    });

    return true;
  },
};

export type LabelTemplateType =
  | "PRODUCT_STICKER_30x20"
  | "PRODUCT_STICKER_40x30"
  | "SHELF_TAG_50x30"
  | "SHELF_TAG_70x40"
  | "A4_GRID_3x8"
  | "A4_GRID_4x10";

export interface LabelDesignOptions {
  templateType: LabelTemplateType;
  showStoreName: boolean;
  showPrice: boolean;
  showBarcode: boolean;
  showSku: boolean;
  showZone: boolean;
  showUnit: boolean;
  showPrintDate: boolean;
  barcodeFormat: "EAN_13" | "CODE_128" | "QR_CODE";
  fontSize: "sm" | "md" | "lg";
}

export interface LabelItemToPrint {
  productId: string;
  name: string;
  barcode: string;
  sku: string;
  price: number;
  unitName: string;
  zoneName?: string;
  copies: number;
}

export const DEFAULT_LABEL_OPTIONS: LabelDesignOptions = {
  templateType: "SHELF_TAG_50x30",
  showStoreName: true,
  showPrice: true,
  showBarcode: true,
  showSku: true,
  showZone: true,
  showUnit: true,
  showPrintDate: false,
  barcodeFormat: "EAN_13",
  fontSize: "md",
};
