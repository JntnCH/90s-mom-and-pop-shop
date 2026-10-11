/**
 * Backup & Restore Engine (Phase 12)
 * MiniMark Grocery & Retail Store Management
 */

import { AuthService, DEFAULT_USERS, type StaffUser } from "./auth-rbac";
import {
  DEFAULT_PRINT_JOBS,
  DEFAULT_PRINTERS,
  DEFAULT_RECEIPT_CONFIG,
  PrinterService,
  type PrinterDevice,
  type PrintJobRecord,
  type ReceiptDesignConfig,
} from "./printer-service";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FOLLOWERS,
  DEFAULT_MOVEMENTS,
  DEFAULT_PRODUCTS,
  DEFAULT_PURCHASE_ORDERS,
  DEFAULT_UNITS,
  DEFAULT_ZONES,
  MasterStore,
  STORAGE_KEYS,
  type CategoryItem,
  type LineUserFollower,
  type ProductItem,
  type PurchaseOrderRecord,
  type ReceiveItem,
  type SubCategoryItem,
  type StockMovementLog,
  type UnitItem,
  type ZoneItem,
} from "./store";

export interface BackupMetadata {
  version: string;
  schemaVersion: number;
  appName: string;
  storeName: string;
  branchName: string;
  createdAt: string; // ISO
  createdAtThai: string;
  exportedBy: string;
  totalProducts: number;
  totalStockUnits: number;
  totalOrders: number;
  totalMovements: number;
  totalPrintJobs: number;
  totalUsers: number;
}

export interface BackupDataPayload {
  products: ProductItem[];
  categories: CategoryItem[];
  subCategories?: SubCategoryItem[];
  units: UnitItem[];
  zones: ZoneItem[];
  movements: StockMovementLog[];
  purchaseOrders: PurchaseOrderRecord[];
  receives: ReceiveItem[];
  followers: LineUserFollower[];
  printers: PrinterDevice[];
  receiptConfig: ReceiptDesignConfig;
  printJobs: PrintJobRecord[];
  staffUsers: StaffUser[];
}

export interface BackupPackage {
  format: "MINIMARK_BACKUP_V1";
  metadata: BackupMetadata;
  data: BackupDataPayload;
}

export interface DatabaseStats {
  productsCount: number;
  totalStockUnits: number;
  categoriesCount: number;
  zonesCount: number;
  unitsCount: number;
  movementsCount: number;
  purchaseOrdersCount: number;
  printJobsCount: number;
  usersCount: number;
  approxStorageKb: number;
  lastBackupDate?: string;
}

const STORAGE_KEY_LAST_BACKUP = "minimark_last_backup_meta";

export const BackupService = {
  /**
   * Calculate current database statistics
   */
  getDatabaseStats(): DatabaseStats {
    const products = MasterStore.getProducts();
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const categories = MasterStore.getCategories();
    const zones = MasterStore.getZones();
    const units = MasterStore.getUnits();
    const movements = MasterStore.getMovements();
    const purchaseOrders = MasterStore.getPurchaseOrders();
    const printJobs = PrinterService.getPrintJobs();
    const users = AuthService.getUsers();

    let totalChars = 0;
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("minimark_")) {
            const val = localStorage.getItem(key) || "";
            totalChars += key.length + val.length;
          }
        }
      } catch {
        // ignore
      }
    }
    const approxStorageKb = Math.round((totalChars * 2) / 1024); // UTF-16 approx

    let lastBackupDate: string | undefined;
    if (typeof window !== "undefined") {
      lastBackupDate = localStorage.getItem(STORAGE_KEY_LAST_BACKUP) || undefined;
    }

    return {
      productsCount: products.length,
      totalStockUnits: totalStock,
      categoriesCount: categories.length,
      zonesCount: zones.length,
      unitsCount: units.length,
      movementsCount: movements.length,
      purchaseOrdersCount: purchaseOrders.length,
      printJobsCount: printJobs.length,
      usersCount: users.length,
      approxStorageKb,
      ...(lastBackupDate !== undefined ? { lastBackupDate } : {}),
    };
  },

  /**
   * Generates a complete JSON backup package
   */
  generateBackupPackage(options?: {
    includeTransactions?: boolean;
    includePrinters?: boolean;
    includeStaff?: boolean;
  }): BackupPackage {
    const includeTx = options?.includeTransactions ?? true;
    const includePtr = options?.includePrinters ?? true;
    const includeUsers = options?.includeStaff ?? true;

    const receiptConfig = PrinterService.getReceiptConfig();
    const currentUser = AuthService.getCurrentUser();
    const products = MasterStore.getProducts();
    const movements = includeTx ? MasterStore.getMovements() : [];
    const purchaseOrders = includeTx ? MasterStore.getPurchaseOrders() : [];
    const receives = includeTx ? MasterStore.getReceives() : [];
    const printJobs = includeTx ? PrinterService.getPrintJobs() : [];

    const now = new Date();
    const nowThai =
      now.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      " " +
      now.toLocaleTimeString("th-TH") +
      " น.";

    const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);

    const metadata: BackupMetadata = {
      version: "1.0.0",
      schemaVersion: 1,
      appName: "MiniMark Retail Management",
      storeName: receiptConfig.storeName,
      branchName: receiptConfig.branchName,
      createdAt: now.toISOString(),
      createdAtThai: nowThai,
      exportedBy: `${currentUser.name} (${currentUser.role})`,
      totalProducts: products.length,
      totalStockUnits: totalStock,
      totalOrders: purchaseOrders.length,
      totalMovements: movements.length,
      totalPrintJobs: printJobs.length,
      totalUsers: includeUsers ? AuthService.getUsers().length : 0,
    };

    const data: BackupDataPayload = {
      products,
      categories: MasterStore.getCategories(),
      subCategories: MasterStore.getSubCategories(),
      units: MasterStore.getUnits(),
      zones: MasterStore.getZones(),
      movements,
      purchaseOrders,
      receives,
      followers: MasterStore.getFollowers(),
      printers: includePtr ? PrinterService.getPrinters() : DEFAULT_PRINTERS,
      receiptConfig,
      printJobs,
      staffUsers: includeUsers ? AuthService.getUsers() : DEFAULT_USERS,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_LAST_BACKUP, nowThai);
    }

    return {
      format: "MINIMARK_BACKUP_V1",
      metadata,
      data,
    };
  },

  /**
   * Trigger download of the JSON backup file in the browser
   */
  downloadBackupFile(backupPackage: BackupPackage, filename?: string): void {
    const jsonStr = JSON.stringify(backupPackage, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeFilename = filename || `minimark_backup_${dateStr}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Parse and validate backup JSON string
   */
  validateBackupFile(jsonString: string): {
    isValid: boolean;
    error?: string;
    package?: BackupPackage;
  } {
    try {
      const parsed = JSON.parse(jsonString);

      if (!parsed || typeof parsed !== "object") {
        return { isValid: false, error: "ไฟล์สำรองข้อมูลไม่ถูกต้อง (รูปแบบไม่ใช่ JSON Object)" };
      }

      if (parsed.format !== "MINIMARK_BACKUP_V1") {
        return {
          isValid: false,
          error: "ไฟล์สำรองนี้ไม่ใช่รูปแบบ MiniMark Backup V1 ที่ระบบรองรับ",
        };
      }

      if (!parsed.metadata || !parsed.data) {
        return {
          isValid: false,
          error: "ข้อมูลโครงสร้างในไฟล์สำรองไม่ครบถ้วน (ขาด metadata หรือ data)",
        };
      }

      if (!Array.isArray(parsed.data.products)) {
        return {
          isValid: false,
          error: "ข้อมูลสินค้าในไฟล์สำรองไม่ถูกต้อง (products ไม่ใช่ Array)",
        };
      }

      return {
        isValid: true,
        package: parsed as BackupPackage,
      };
    } catch {
      return { isValid: false, error: "ไม่สามารถแปลงไฟล์ JSON ได้ กรุณาตรวจสอบความถูกต้องของไฟล์" };
    }
  },

  /**
   * Restore database from backup package
   */
  restoreBackup(
    backup: BackupPackage,
    mode: "OVERWRITE" | "MERGE" = "OVERWRITE",
  ): {
    success: boolean;
    stats: { products: number; orders: number; movements: number };
    error?: string;
  } {
    if (typeof window === "undefined") {
      return {
        success: false,
        stats: { products: 0, orders: 0, movements: 0 },
        error: "SSR Environment",
      };
    }

    try {
      const { data } = backup;

      if (mode === "OVERWRITE") {
        // Overwrite Master Collections
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products || []));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories || []));
        localStorage.setItem(STORAGE_KEYS.SUBCATEGORIES, JSON.stringify(data.subCategories || []));
        localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(data.units || []));
        localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(data.zones || []));
        localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(data.movements || []));
        localStorage.setItem(
          STORAGE_KEYS.PURCHASE_ORDERS,
          JSON.stringify(data.purchaseOrders || []),
        );
        localStorage.setItem(STORAGE_KEYS.RECEIVES, JSON.stringify(data.receives || []));
        localStorage.setItem(STORAGE_KEYS.FOLLOWERS, JSON.stringify(data.followers || []));

        if (data.printers && data.printers.length > 0) {
          localStorage.setItem("minimark_printers_v1", JSON.stringify(data.printers));
        }
        if (data.receiptConfig) {
          localStorage.setItem("minimark_receipt_config_v1", JSON.stringify(data.receiptConfig));
        }
        if (data.printJobs) {
          localStorage.setItem("minimark_print_jobs_v1", JSON.stringify(data.printJobs));
        }
        if (data.staffUsers && data.staffUsers.length > 0) {
          localStorage.setItem("minimark_rbac_users_v1", JSON.stringify(data.staffUsers));
        }
      } else {
        // MERGE MODE
        const currentProducts = MasterStore.getProducts();
        const existingSkus = new Set(currentProducts.map((p) => p.sku));
        const mergedProducts = [...currentProducts];

        (data.products || []).forEach((newP) => {
          if (!existingSkus.has(newP.sku)) {
            mergedProducts.push(newP);
            existingSkus.add(newP.sku);
          }
        });
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mergedProducts));

        // Merge Categories
        const currentCats = MasterStore.getCategories();
        const catCodes = new Set(currentCats.map((c) => c.code));
        const mergedCats = [...currentCats];
        (data.categories || []).forEach((c) => {
          if (!catCodes.has(c.code)) {
            mergedCats.push(c);
            catCodes.add(c.code);
          }
        });
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(mergedCats));

        // Merge Subcategories by ID so older backup packages remain supported.
        const currentSubCategories = MasterStore.getSubCategories();
        const subCategoryIds = new Set(currentSubCategories.map((item) => item.id));
        const mergedSubCategories = [...currentSubCategories];
        (data.subCategories || []).forEach((item) => {
          if (!subCategoryIds.has(item.id)) {
            mergedSubCategories.push(item);
            subCategoryIds.add(item.id);
          }
        });
        localStorage.setItem(STORAGE_KEYS.SUBCATEGORIES, JSON.stringify(mergedSubCategories));

        // Merge Units
        const currentUnits = MasterStore.getUnits();
        const unitNames = new Set(currentUnits.map((u) => u.name));
        const mergedUnits = [...currentUnits];
        (data.units || []).forEach((u) => {
          if (!unitNames.has(u.name)) {
            mergedUnits.push(u);
            unitNames.add(u.name);
          }
        });
        localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(mergedUnits));

        // Merge Zones
        const currentZones = MasterStore.getZones();
        const zoneCodes = new Set(currentZones.map((z) => z.code));
        const mergedZones = [...currentZones];
        (data.zones || []).forEach((z) => {
          if (!zoneCodes.has(z.code)) {
            mergedZones.push(z);
            zoneCodes.add(z.code);
          }
        });
        localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(mergedZones));
      }

      // Dispatch change events to refresh all UI components across the app
      window.dispatchEvent(new Event("minimark_store_change"));
      window.dispatchEvent(new Event("minimark_printers_change"));
      window.dispatchEvent(new Event("minimark_receipt_config_change"));
      window.dispatchEvent(new Event("minimark_print_jobs_change"));
      window.dispatchEvent(new Event("minimark_auth_change"));

      return {
        success: true,
        stats: {
          products: data.products?.length || 0,
          orders: data.purchaseOrders?.length || 0,
          movements: data.movements?.length || 0,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        stats: { products: 0, orders: 0, movements: 0 },
        error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการกู้คืนข้อมูล",
      };
    }
  },

  /**
   * Danger Zone: Clear transaction records only (Stock movements, receives, purchase orders, print jobs)
   * Keeps products, categories, units, zones, settings, and staff users intact.
   */
  clearTransactionsOnly(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.RECEIVES, JSON.stringify([]));
    localStorage.setItem("minimark_print_jobs_v1", JSON.stringify([]));

    window.dispatchEvent(new Event("minimark_store_change"));
    window.dispatchEvent(new Event("minimark_print_jobs_change"));
  },

  /**
   * Danger Zone: Clear all mock/sample data (products, movements, purchase orders, receives, print jobs)
   * Keeps structure (categories, units, zones) and staff authentication intact for real production store operations.
   */
  clearAllMockData(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.RECEIVES, JSON.stringify([]));
    try {
      localStorage.removeItem(STORAGE_KEYS.PO_DRAFT);
      localStorage.setItem("minimark_print_jobs_v1", JSON.stringify([]));
    } catch {
      // ignore
    }

    window.dispatchEvent(new Event("minimark_store_change"));
    window.dispatchEvent(new Event("minimark_print_jobs_change"));
  },

  /**
   * Danger Zone: Factory Reset all collections back to initial default seed data
   */
  factoryResetAndSeed(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(DEFAULT_UNITS));
    localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(DEFAULT_ZONES));
    localStorage.setItem(STORAGE_KEYS.FOLLOWERS, JSON.stringify(DEFAULT_FOLLOWERS));
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(DEFAULT_MOVEMENTS));
    localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(DEFAULT_PURCHASE_ORDERS));
    localStorage.setItem(STORAGE_KEYS.RECEIVES, JSON.stringify([]));
    localStorage.setItem("minimark_printers_v1", JSON.stringify(DEFAULT_PRINTERS));
    localStorage.setItem("minimark_receipt_config_v1", JSON.stringify(DEFAULT_RECEIPT_CONFIG));
    localStorage.setItem("minimark_print_jobs_v1", JSON.stringify(DEFAULT_PRINT_JOBS));
    localStorage.setItem("minimark_rbac_users_v1", JSON.stringify(DEFAULT_USERS));
    const defaultAdmin = DEFAULT_USERS.find((user) => user.role === "ADMIN");
    if (defaultAdmin) {
      localStorage.setItem("minimark_rbac_current_user_v1", defaultAdmin.id);
    }

    window.dispatchEvent(new Event("minimark_store_change"));
    window.dispatchEvent(new Event("minimark_printers_change"));
    window.dispatchEvent(new Event("minimark_receipt_config_change"));
    window.dispatchEvent(new Event("minimark_print_jobs_change"));
    window.dispatchEvent(new Event("minimark_auth_change"));
  },
};
