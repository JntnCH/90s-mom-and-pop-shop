/**
 * Master Data & Application Store
 * Stores Zones, Categories, Units, Products, and Orders with persistence.
 */

import { useEffect, useState } from "react";
import { removeLegacySampleLineFollowers } from "./line-follower-data";
import { generateCategoryCode } from "./category-code-generator";

export interface ZoneItem {
  id: string;
  name: string;
  code: string;
  description?: string | undefined;
}

export interface CategoryItem {
  id: string;
  name: string;
  code: string;
}

export interface SubCategoryItem {
  id: string;
  categoryId: string;
  name: string;
  code: string;
}

export interface UnitItem {
  id: string;
  name: string;
  shortName: string;
}

export interface ProductItem {
  id: string;
  sku: string;
  barcode: string;
  codeType: "QR" | "Barcode";
  format?: string | undefined;
  name: string;
  imageUrl?: string | undefined;
  categoryId: string;
  subCategoryId?: string | undefined;
  zoneId?: string | undefined;
  unitId: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  targetStock: number;
  reorderQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiveItem {
  id: string;
  barcode: string;
  codeType: "QR" | "Barcode";
  format?: string | undefined;
  productName: string;
  unit: string;
  quantity: number;
  scannedAt: string;
}

export interface LineUserFollower {
  userId: string;
  displayName: string;
  pictureUrl?: string | undefined;
  statusMessage?: string | undefined;
  followedAt: string;
  lastInteractionAt: string;
  role: "admin" | "staff" | "viewer";
}

export interface StockMovementLog {
  id: string;
  timestamp: string;
  productId: string;
  productName: string;
  barcode: string;
  type: "RECEIVE" | "ISSUE" | "ADJUST" | "INITIAL";
  quantity: number;
  previousStock: number;
  newStock: number;
  operator: string;
  note?: string | undefined;
}

export interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  supplierName?: string | undefined;
  items: {
    productId: string;
    productName: string;
    barcode: string;
    quantity: number;
    unitName: string;
    unitId?: string | undefined;
    costPrice: number;
    total: number;
    note?: string | undefined;
    categoryId?: string | undefined;
    subCategoryId?: string | undefined;
    zoneId?: string | undefined;
  }[];
  totalQuantity: number;
  totalCost: number;
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
  sentViaLineAt?: string | undefined;
}

export const DEFAULT_ZONES: ZoneItem[] = [
  { id: "zone-a", code: "Z-A", name: "โซน A (หน้าร้าน/เคาน์เตอร์)", description: "สินค้าขายดี ขนม บุหรี่" },
  { id: "zone-b", code: "Z-B", name: "โซน B (ชั้นกลาง อาหารแห้ง)", description: "บะหมี่สำเร็จรูป เครื่องปรุงรส" },
  { id: "zone-c", code: "Z-C", name: "โซน C (ตู้แช่ เครื่องดื่ม)", description: "น้ำอัดลม นม น้ำดื่ม เบียร์" },
  { id: "zone-d", code: "Z-D", name: "โซน D (ของใช้ในบ้าน/ซักล้าง)", description: "ผงซักฟอก ยาสระผม สบู่" },
  { id: "zone-e", code: "Z-E", name: "โซน E (หลังร้าน/สต็อกสำรอง)", description: "กล่องสต็อกสำรอง" },
];

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "cat-beverage", code: "BEV", name: "เครื่องดื่ม" },
  { id: "cat-snack", code: "SNK", name: "ขนมขบเคี้ยว" },
  { id: "cat-food", code: "FOD", name: "อาหารสำเร็จรูปและแห้ง" },
  { id: "cat-household", code: "HSH", name: "ของใช้ในครัวเรือน" },
  { id: "cat-personal", code: "PER", name: "ของใช้ส่วนตัว" },
  { id: "cat-general", code: "GEN", name: "สินค้าเบ็ดเตล็ด" },
];

export const DEFAULT_SUBCATEGORIES: SubCategoryItem[] = [
  { id: "sub-bev-milk", categoryId: "cat-beverage", code: "MILK", name: "นมและผลิตภัณฑ์นม" },
  { id: "sub-bev-soda", categoryId: "cat-beverage", code: "SODA", name: "น้ำอัดลมและน้ำหวาน" },
  { id: "sub-bev-water", categoryId: "cat-beverage", code: "WTR", name: "น้ำดื่ม ชา และกาแฟ" },
  { id: "sub-snk-chips", categoryId: "cat-snack", code: "CHIP", name: "มันฝรั่งทอดและสแน็ค" },
  { id: "sub-snk-bisc", categoryId: "cat-snack", code: "BISC", name: "บิสกิต คุกกี้ และเวเฟอร์" },
  { id: "sub-fod-nood", categoryId: "cat-food", code: "NOOD", name: "บะหมี่และโจ๊กกึ่งสำเร็จรูป" },
  { id: "sub-fod-canned", categoryId: "cat-food", code: "CAND", name: "ปลากระป๋องและอาหารกระป๋อง" },
  { id: "sub-fod-season", categoryId: "cat-food", code: "SEAS", name: "เครื่องปรุงรสและซอส" },
  { id: "sub-hsh-deter", categoryId: "cat-household", code: "DETR", name: "ผงซักฟอกและน้ำยาทำความสะอาด" },
  { id: "sub-hsh-tissue", categoryId: "cat-household", code: "TISS", name: "กระดาษทิชชู่และถุงขยะ" },
  { id: "sub-per-bath", categoryId: "cat-personal", code: "BATH", name: "สบู่ แชมพู และยาสีฟัน" },
  { id: "sub-gen-misc", categoryId: "cat-general", code: "MISC", name: "ของใช้เบ็ดเตล็ดทั่วไป" },
];

export const DEFAULT_UNITS: UnitItem[] = [
  { id: "unit-piece", name: "ชิ้น", shortName: "ชิ้น" },
  { id: "unit-pack", name: "แพ็ค", shortName: "แพ็ค" },
  { id: "unit-box", name: "กล่อง", shortName: "กล่อง" },
  { id: "unit-bottle", name: "ขวด", shortName: "ขวด" },
  { id: "unit-can", name: "กระป๋อง", shortName: "กป." },
  { id: "unit-bag", name: "ซอง", shortName: "ซอง" },
  { id: "unit-crate", name: "ลัง", shortName: "ลัง" },
];

export const DEFAULT_FOLLOWERS: LineUserFollower[] = [];
export const DEFAULT_MOVEMENTS: StockMovementLog[] = [];
export const DEFAULT_PURCHASE_ORDERS: PurchaseOrderRecord[] = [];

export interface StoreProfileConfig {
  storeName: string;
  branchName?: string | undefined;
  taxId?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  headerMessage?: string | undefined;
  footerMessage?: string | undefined;
}

export const DEFAULT_STORE_NAME = "โชห่วยยุค90s";

export const DEFAULT_STORE_PROFILE: StoreProfileConfig = {
  storeName: DEFAULT_STORE_NAME,
  branchName: "สาขา 0001 (หน้าร้านพัฒนาการ)",
  taxId: "0105562098765",
  address: "123/45 ถนนพัฒนาการ แขวงสวนหลวง กรุงเทพฯ 10250",
  phone: "02-123-4567, 081-987-6543",
  headerMessage: "ยินดีต้อนรับสู่ โชห่วยยุค90s สินค้าคุณภาพ ราคากันเอง",
  footerMessage: "ขอบคุณที่ใช้บริการ โชห่วยยุค90s โอกาสหน้าเชิญใหม่ครับ",
};

export const DEFAULT_PRODUCTS: ProductItem[] = [];

export const STORAGE_KEYS = {
  ZONES: "minimark_zones",
  CATEGORIES: "minimark_categories",
  SUBCATEGORIES: "minimark_subcategories",
  UNITS: "minimark_units",
  PRODUCTS: "minimark_products",
  RECEIVES: "minimark_receives",
  FOLLOWERS: "minimark_followers",
  MOVEMENTS: "minimark_movements",
  PURCHASE_ORDERS: "minimark_purchase_orders",
  DELETED_PO_IDS: "minimark_deleted_po_ids",
  PO_DRAFT: "minimark_po_draft",
  STORE_CONFIG: "minimark_store_config",
  STORE_NAME: "minimark_store_name",
};

const PENDING_PRODUCT_PATCHES_KEY = "minimark_pending_product_patches";
const PENDING_DELETED_ZONES_KEY = "minimark_pending_deleted_zones";
const PENDING_DELETED_PRODUCTS_KEY = "minimark_pending_deleted_products";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    if (key === STORAGE_KEYS.PRODUCTS && !localStorage.getItem("minimark_cleaned_mock_v3")) {
      localStorage.setItem("minimark_cleaned_mock_v3", "true");
      const current = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (current) {
        try {
          const parsed = JSON.parse(current);
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every((p: { id?: string }) =>
              ["prod-1", "prod-2", "prod-3", "prod-4", "prod-5"].includes(p?.id || ""),
            )
          ) {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify([]));
            return fallback;
          }
        } catch {
          // ignore
        }
      }
    }
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

let syncChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    syncChannel = new BroadcastChannel("minimark_sync_channel");
    syncChannel.onmessage = (event) => {
      if (event.data?.type === "STORE_UPDATED") {
        window.dispatchEvent(new Event("minimark_store_change"));
      }
    };
  } catch {
    // Ignore if not supported
  }
}

export function getPendingDeletedZones(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_DELETED_ZONES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addPendingDeletedZone(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPendingDeletedZones();
    if (!current.includes(id)) {
      localStorage.setItem(PENDING_DELETED_ZONES_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    // ignore
  }
}

export function clearPendingDeletedZones(idsToClear: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPendingDeletedZones();
    const remaining = current.filter((id) => !idsToClear.includes(id));
    if (remaining.length > 0) {
      localStorage.setItem(PENDING_DELETED_ZONES_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(PENDING_DELETED_ZONES_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearPendingDeletedPOs(idsToClear: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = safeGet<string[]>(STORAGE_KEYS.DELETED_PO_IDS, []);
    const remaining = current.filter((id) => !idsToClear.includes(id));
    if (remaining.length > 0) {
      localStorage.setItem(STORAGE_KEYS.DELETED_PO_IDS, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(STORAGE_KEYS.DELETED_PO_IDS);
    }
  } catch {
    // ignore
  }
}

export function getPendingDeletedProducts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_DELETED_PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addPendingDeletedProduct(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPendingDeletedProducts();
    if (!current.includes(id)) {
      localStorage.setItem(PENDING_DELETED_PRODUCTS_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    // ignore
  }
}

export function clearPendingDeletedProducts(idsToClear: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPendingDeletedProducts();
    const remaining = current.filter((id) => !idsToClear.includes(id));
    if (remaining.length > 0) {
      localStorage.setItem(PENDING_DELETED_PRODUCTS_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(PENDING_DELETED_PRODUCTS_KEY);
    }
  } catch {
    // ignore
  }
}

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
let storeNotifyTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingServerSnapshot = false;
let isSyncInFlight = false;
const SERVER_SYNC_DEBOUNCE_MS = 2500;
const STORE_NOTIFY_DEBOUNCE_MS = 80;
const MAX_SYNC_MOVEMENTS = 200;
const MAX_SYNC_RECEIVES = 100;

function notifyStoreChange(key: string) {
  if (typeof window === "undefined") return;
  if (storeNotifyTimer) clearTimeout(storeNotifyTimer);
  storeNotifyTimer = setTimeout(() => {
    storeNotifyTimer = null;
    window.dispatchEvent(new Event("minimark_store_change"));
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: "STORE_UPDATED", key, timestamp: Date.now() });
      } catch {
        // ignore
      }
    }
  }, STORE_NOTIFY_DEBOUNCE_MS);
}

export function triggerCentralServerSync(immediate = false) {
  if (typeof window === "undefined" || isApplyingServerSnapshot) return;
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  const doSync = async () => {
    if (isSyncInFlight) {
      serverSyncTimer = setTimeout(() => {
        void triggerCentralServerSync(true);
      }, 400);
      return;
    }
    isSyncInFlight = true;
    try {
      const { syncMasterDatabaseFn } = await import("./line-server-fn");
      const deletedZoneIds = getPendingDeletedZones();
      const deletedPOIds = safeGet<string[]>(STORAGE_KEYS.DELETED_PO_IDS, []);
      const deletedProductIds = getPendingDeletedProducts();
      const allMovements = MasterStore.getMovements();
      const allReceives = MasterStore.getReceives();
      const res = await syncMasterDatabaseFn({
        data: {
          products: MasterStore.getProducts(),
          categories: MasterStore.getCategories(),
          subCategories: MasterStore.getSubCategories(),
          zones: MasterStore.getZones(),
          replaceZones: true,
          ...(deletedZoneIds.length > 0 ? { deletedZoneIds } : {}),
          ...(deletedPOIds.length > 0 ? { deletedPurchaseOrderIds: deletedPOIds } : {}),
          ...(deletedProductIds.length > 0 ? { deletedProductIds } : {}),
          units: MasterStore.getUnits(),
          receives: allReceives.slice(-MAX_SYNC_RECEIVES),
          followers: MasterStore.getFollowers(),
          movements: allMovements.slice(-MAX_SYNC_MOVEMENTS),
          purchaseOrders: MasterStore.getPurchaseOrders(),
        },
      });
      if (res?.success && res.data) {
        if (deletedZoneIds.length > 0) clearPendingDeletedZones(deletedZoneIds);
        if (deletedPOIds.length > 0) clearPendingDeletedPOs(deletedPOIds);
        if (deletedProductIds.length > 0) clearPendingDeletedProducts(deletedProductIds);
        MasterStore.syncDatabaseSnapshot(
          res.data as Parameters<typeof MasterStore.syncDatabaseSnapshot>[0],
        );
      }
    } catch (err) {
      console.warn("[Store] Server sync notice:", err);
    } finally {
      isSyncInFlight = false;
    }
  };
  if (immediate) {
    void doSync();
  } else {
    serverSyncTimer = setTimeout(doSync, SERVER_SYNC_DEBOUNCE_MS);
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyStoreChange(key);
    if (
      !isApplyingServerSnapshot &&
      (key === STORAGE_KEYS.PRODUCTS ||
        key === STORAGE_KEYS.CATEGORIES ||
        key === STORAGE_KEYS.SUBCATEGORIES ||
        key === STORAGE_KEYS.ZONES ||
        key === STORAGE_KEYS.UNITS ||
        key === STORAGE_KEYS.PURCHASE_ORDERS ||
        key === STORAGE_KEYS.DELETED_PO_IDS)
    ) {
      triggerCentralServerSync();
    }
  } catch {
    // ignore
  }
}

export function calculateSuggestedQuantity(
  product: ProductItem,
  strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
  customMultiplier: number = 1.0,
): number {
  const current = Math.max(0, product.stock || 0);
  const min = Math.max(1, product.minStock || 5);
  const target = Math.max(min, product.targetStock || product.reorderQuantity || min * 2);
  let calculated = 0;
  switch (strategy) {
    case "TARGET_PAR":
      calculated = Math.max(0, target - current);
      break;
    case "MINIMUM_RESTORE":
      calculated = Math.max(1, min + Math.ceil(min * 0.2) - current);
      break;
    case "WEEKEND_BUFFER":
      calculated = Math.max(1, Math.ceil((target - current) * 1.5));
      break;
    case "DOUBLE_BUFFER":
      calculated = Math.max(1, Math.ceil((target - current) * 2.0));
      break;
  }
  if (customMultiplier > 0 && customMultiplier !== 1.0) {
    calculated = Math.max(1, Math.ceil(calculated * customMultiplier));
  }
  if (calculated <= 0 && current <= min) {
    calculated = Math.max(1, product.reorderQuantity || min);
  }
  return calculated;
}

export interface SmartReorderForecastItem {
  product: ProductItem;
  currentStock: number;
  minStock: number;
  targetStock: number;
  suggestedQuantity: number;
  estimatedCost: number;
  urgency: "HIGH" | "MEDIUM";
  isOutOfStock: boolean;
}

export function getSmartReorderForecast(
  products?: ProductItem[],
  strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
  multiplier: number = 1.0,
): SmartReorderForecastItem[] {
  const list = products && products.length > 0 ? products : MasterStore.getReorderProducts();
  return list.map((p) => {
    const suggestedQty = calculateSuggestedQuantity(p, strategy, multiplier);
    const isOutOfStock = p.stock <= 0;
    const urgency = isOutOfStock
      ? ("HIGH" as const)
      : p.stock <= Math.ceil(p.minStock * 0.5)
        ? ("HIGH" as const)
        : ("MEDIUM" as const);
    const estimatedCost = (p.costPrice || 0) * suggestedQty;
    return {
      product: p,
      currentStock: p.stock,
      minStock: p.minStock,
      targetStock: p.targetStock || p.reorderQuantity || p.minStock * 2,
      suggestedQuantity: suggestedQty,
      estimatedCost,
      urgency,
      isOutOfStock,
    };
  });
}

export const MasterStore = {
  hasSavedZones(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.ZONES) !== null;
  },
  getZones(): ZoneItem[] {
    return safeGet<ZoneItem[]>(STORAGE_KEYS.ZONES, DEFAULT_ZONES);
  },
  saveZones(items: ZoneItem[]) {
    safeSet(STORAGE_KEYS.ZONES, items);
  },
  addZone(item: Omit<ZoneItem, "id">) {
    const list = this.getZones();
    const newItem: ZoneItem = { ...item, id: `zone-${Date.now()}` };
    this.saveZones([...list, newItem]);
    return newItem;
  },
  updateZone(id: string, updates: Partial<ZoneItem>) {
    const list = this.getZones().map((z) => (z.id === id ? { ...z, ...updates } : z));
    this.saveZones(list);
  },
  deleteZone(id: string) {
    addPendingDeletedZone(id);
    const list = this.getZones().filter((z) => z.id !== id);
    this.saveZones(list);
  },

  getCategories(): CategoryItem[] {
    return safeGet<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  },
  saveCategories(items: CategoryItem[]) {
    safeSet(STORAGE_KEYS.CATEGORIES, items);
  },
  addCategory(item: Omit<CategoryItem, "id">) {
    const list = this.getCategories();
    const cleanCode = item.code?.trim();
    const finalCode =
      cleanCode && cleanCode !== "-" && cleanCode !== "—"
        ? cleanCode.toUpperCase()
        : generateCategoryCode(item.name, list);
    const newItem: CategoryItem = { ...item, code: finalCode, id: `cat-${Date.now()}` };
    this.saveCategories([...list, newItem]);
    return newItem;
  },
  updateCategory(id: string, updates: Partial<CategoryItem>) {
    const list = this.getCategories().map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, ...updates };
      if (updates.code !== undefined) {
        const cleanCode = updates.code.trim();
        updated.code =
          cleanCode && cleanCode !== "-" && cleanCode !== "—"
            ? cleanCode.toUpperCase()
            : generateCategoryCode(updated.name, this.getCategories().filter((x) => x.id !== id));
      }
      return updated;
    });
    this.saveCategories(list);
  },
  deleteCategory(id: string) {
    const list = this.getCategories().filter((c) => c.id !== id);
    this.saveCategories(list);
  },

  getSubCategories(): SubCategoryItem[] {
    return safeGet<SubCategoryItem[]>(STORAGE_KEYS.SUBCATEGORIES, DEFAULT_SUBCATEGORIES);
  },
  saveSubCategories(items: SubCategoryItem[]) {
    safeSet(STORAGE_KEYS.SUBCATEGORIES, items);
  },
  addSubCategory(item: Omit<SubCategoryItem, "id">) {
    const list = this.getSubCategories();
    const newItem: SubCategoryItem = { ...item, id: `sub-${Date.now()}` };
    this.saveSubCategories([...list, newItem]);
    return newItem;
  },
  updateSubCategory(id: string, updates: Partial<SubCategoryItem>) {
    const list = this.getSubCategories().map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.saveSubCategories(list);
  },
  deleteSubCategory(id: string) {
    const list = this.getSubCategories().filter((s) => s.id !== id);
    this.saveSubCategories(list);
  },

  getUnits(): UnitItem[] {
    return safeGet<UnitItem[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  },
  saveUnits(items: UnitItem[]) {
    safeSet(STORAGE_KEYS.UNITS, items);
  },
  addUnit(item: Omit<UnitItem, "id">) {
    const list = this.getUnits();
    const newItem: UnitItem = { ...item, id: `unit-${Date.now()}` };
    this.saveUnits([...list, newItem]);
    return newItem;
  },
  updateUnit(id: string, updates: Partial<UnitItem>) {
    const list = this.getUnits().map((u) => (u.id === id ? { ...u, ...updates } : u));
    this.saveUnits(list);
  },
  deleteUnit(id: string) {
    const list = this.getUnits().filter((u) => u.id !== id);
    this.saveUnits(list);
  },

  getProducts(): ProductItem[] {
    return safeGet<ProductItem[]>(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
  },
  saveProducts(items: ProductItem[]) {
    safeSet(STORAGE_KEYS.PRODUCTS, items);
  },
  checkDuplicateSku(sku: string, excludeId?: string): boolean {
    const trimmed = sku.trim().toLowerCase();
    if (!trimmed) return false;
    return this.getProducts().some(
      (p) => p.sku?.trim().toLowerCase() === trimmed && p.id !== excludeId,
    );
  },
  checkDuplicateBarcode(barcode: string, excludeId?: string): boolean {
    const trimmed = barcode.trim();
    if (!trimmed) return false;
    return this.getProducts().some((p) => p.barcode?.trim() === trimmed && p.id !== excludeId);
  },
  addProduct(item: Omit<ProductItem, "id" | "createdAt" | "updatedAt">) {
    const list = this.getProducts();
    const now = new Date().toISOString();
    const newItem: ProductItem = {
      ...item,
      id: `prod-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    this.saveProducts([...list, newItem]);
    return newItem;
  },
  updateProduct(id: string, updates: Partial<ProductItem>) {
    const list = this.getProducts().map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
    );
    this.saveProducts(list);
  },
  toggleProductStatus(id: string): boolean {
    const product = this.getProducts().find((p) => p.id === id);
    if (!product) return false;
    const newStatus = !product.isActive;
    this.updateProduct(id, { isActive: newStatus });
    return newStatus;
  },
  deleteProduct(id: string) {
    addPendingDeletedProduct(id);
    const list = this.getProducts().filter((p) => p.id !== id);
    this.saveProducts(list);
  },
  findByBarcode(code: string): ProductItem | undefined {
    const trimmed = code.trim();
    return this.getProducts().find((p) => p.barcode === trimmed);
  },
  getStockStatus(product: ProductItem): "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK" {
    if (product.stock <= 0) return "OUT_OF_STOCK";
    if (product.stock <= product.minStock) return "LOW_STOCK";
    return "NORMAL";
  },
  getUnitName(unitId?: string): string {
    return this.getUnits().find((u) => u.id === unitId)?.name || "ชิ้น";
  },
  getCategoryName(categoryId?: string): string {
    return this.getCategories().find((c) => c.id === categoryId)?.name || "ไม่ระบุ";
  },
  getSubCategoryName(subCategoryId?: string): string {
    return this.getSubCategories().find((s) => s.id === subCategoryId)?.name || "ไม่ระบุ";
  },
  getZoneName(zoneId?: string): string {
    return this.getZones().find((z) => z.id === zoneId)?.name || "ไม่ระบุ";
  },

  getReorderProducts(): ProductItem[] {
    return this.getProducts().filter((p) => p.isActive !== false && p.stock <= p.minStock);
  },
  getLowStockProducts(): ProductItem[] {
    return this.getProducts().filter(
      (p) => p.isActive !== false && p.stock > 0 && p.stock <= p.minStock,
    );
  },
  getOutOfStockProducts(): ProductItem[] {
    return this.getProducts().filter((p) => p.isActive !== false && p.stock <= 0);
  },
  calculateSuggestedQuantity(
    product: ProductItem,
    strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
    customMultiplier: number = 1.0,
  ): number {
    return calculateSuggestedQuantity(product, strategy, customMultiplier);
  },
  getSmartReorderForecast(
    strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
    multiplier: number = 1.0,
  ): SmartReorderForecastItem[] {
    return getSmartReorderForecast(this.getReorderProducts(), strategy, multiplier);
  },

  getDraftPurchaseOrder() {
    return safeGet<{
      orderList?: {
        productId: string;
        productName: string;
        barcode?: string;
        quantity: number;
        unitId?: string;
        unitName?: string;
        costPrice?: number;
        note?: string;
        categoryId?: string;
        subCategoryId?: string;
        zoneId?: string;
      }[];
      supplierName?: string;
      calculationStrategy?: string;
      savedAt?: string;
    } | null>(STORAGE_KEYS.PO_DRAFT, null);
  },
  saveDraftPurchaseOrder(draft: unknown): void {
    safeSet(STORAGE_KEYS.PO_DRAFT, draft);
  },
  clearDraftPurchaseOrder(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEYS.PO_DRAFT);
        notifyStoreChange(STORAGE_KEYS.PO_DRAFT);
      } catch {
        // ignore
      }
    }
  },

  getDeletedPurchaseOrderIds(): string[] {
    return safeGet<string[]>(STORAGE_KEYS.DELETED_PO_IDS, []);
  },

  getPurchaseOrderById(id: string): PurchaseOrderRecord | undefined {
    return this.getPurchaseOrders().find((po) => po.id === id);
  },

  getReceives(): ReceiveItem[] {
    return safeGet<ReceiveItem[]>(STORAGE_KEYS.RECEIVES, []);
  },
  saveReceives(items: ReceiveItem[]) {
    safeSet(STORAGE_KEYS.RECEIVES, items);
  },
  addReceive(item: Omit<ReceiveItem, "id">) {
    const list = this.getReceives();
    const newItem: ReceiveItem = { ...item, id: `recv-${Date.now()}` };
    this.saveReceives([...list, newItem]);
    return newItem;
  },
  clearReceives(): void {
    this.saveReceives([]);
  },

  getFollowers(): LineUserFollower[] {
    return safeGet<LineUserFollower[]>(STORAGE_KEYS.FOLLOWERS, DEFAULT_FOLLOWERS);
  },
  saveFollowers(items: LineUserFollower[]) {
    safeSet(STORAGE_KEYS.FOLLOWERS, items);
  },
  saveFollower(follower: LineUserFollower): void {
    const list = this.getFollowers();
    const exists = list.some((f) => f.userId === follower.userId);
    const nextList = exists
      ? list.map((f) => (f.userId === follower.userId ? { ...f, ...follower } : f))
      : [...list, follower];
    this.saveFollowers(nextList);
  },

  getMovements(): StockMovementLog[] {
    return safeGet<StockMovementLog[]>(STORAGE_KEYS.MOVEMENTS, DEFAULT_MOVEMENTS);
  },
  saveMovements(items: StockMovementLog[]) {
    safeSet(STORAGE_KEYS.MOVEMENTS, items);
  },
  addMovement(item: Omit<StockMovementLog, "id">) {
    const list = this.getMovements();
    const newItem: StockMovementLog = { ...item, id: `mov-${Date.now()}` };
    this.saveMovements([...list, newItem]);
    return newItem;
  },
  clearMovements(): void {
    this.saveMovements([]);
  },

  receiveStock(
    productIdOrBarcode: string,
    quantity: number,
    operator: string = "ผู้ดูแลระบบ",
    note?: string,
    fallbackProductName?: string,
  ): { success: boolean; product?: ProductItem; error?: string } {
    if (quantity <= 0) return { success: false, error: "จำนวนต้องมากกว่า 0" };
    const allProds = this.getProducts();
    const prod = allProds.find(
      (p) => p.id === productIdOrBarcode || p.barcode === productIdOrBarcode,
    );
    if (!prod) {
      return { success: false, error: "ไม่พบสินค้าในระบบ" };
    }
    const prevStock = prod.stock || 0;
    const newStock = prevStock + quantity;
    const updated = {
      ...prod,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };
    this.updateProduct(prod.id, updated);
    this.addMovement({
      timestamp: new Date().toISOString(),
      productId: prod.id,
      productName: prod.name || fallbackProductName || "สินค้า",
      barcode: prod.barcode,
      type: "RECEIVE",
      quantity,
      previousStock: prevStock,
      newStock,
      operator,
      note: note || `รับสินค้าเข้าสต็อก +${quantity}`,
    });
    return { success: true, product: updated };
  },

  issueStock(
    productIdOrBarcode: string,
    quantity: number,
    operator: string = "ผู้เบิกจ่าย",
    note?: string,
  ): { success: boolean; product?: ProductItem; error?: string } {
    if (quantity <= 0) return { success: false, error: "จำนวนต้องมากกว่า 0" };
    const allProds = this.getProducts();
    const prod = allProds.find(
      (p) => p.id === productIdOrBarcode || p.barcode === productIdOrBarcode,
    );
    if (!prod) {
      return { success: false, error: "ไม่พบสินค้าในระบบ" };
    }
    const prevStock = prod.stock || 0;
    const newStock = Math.max(0, prevStock - quantity);
    const updated = {
      ...prod,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };
    this.updateProduct(prod.id, updated);
    this.addMovement({
      timestamp: new Date().toISOString(),
      productId: prod.id,
      productName: prod.name,
      barcode: prod.barcode,
      type: "ISSUE",
      quantity,
      previousStock: prevStock,
      newStock,
      operator,
      note: note || `จ่ายสินค้าออก -${quantity}`,
    });
    return { success: true, product: updated };
  },

  adjustStock(
    productIdOrBarcode: string,
    newStockValue: number,
    operator: string = "ผู้ดูแลระบบ",
    note?: string,
  ): { success: boolean; product?: ProductItem; error?: string } {
    const validStock = Math.max(0, Number(newStockValue) || 0);
    const allProds = this.getProducts();
    const prod = allProds.find(
      (p) => p.id === productIdOrBarcode || p.barcode === productIdOrBarcode,
    );
    if (!prod) {
      return { success: false, error: "ไม่พบสินค้าในระบบ" };
    }
    const prevStock = prod.stock || 0;
    const diff = validStock - prevStock;
    const updated = {
      ...prod,
      stock: validStock,
      updatedAt: new Date().toISOString(),
    };
    this.updateProduct(prod.id, updated);
    this.addMovement({
      timestamp: new Date().toISOString(),
      productId: prod.id,
      productName: prod.name,
      barcode: prod.barcode,
      type: "ADJUST",
      quantity: Math.abs(diff),
      previousStock: prevStock,
      newStock: validStock,
      operator,
      note: note || `ปรับสต็อก (${prevStock} -> ${validStock})`,
    });
    return { success: true, product: updated };
  },

  getPurchaseOrders(): PurchaseOrderRecord[] {
    return safeGet<PurchaseOrderRecord[]>(STORAGE_KEYS.PURCHASE_ORDERS, DEFAULT_PURCHASE_ORDERS);
  },
  savePurchaseOrders(items: PurchaseOrderRecord[]) {
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, items);
  },
  addPurchaseOrder(item: Omit<PurchaseOrderRecord, "id">) {
    const list = this.getPurchaseOrders();
    const newItem: PurchaseOrderRecord = { ...item, id: `po-${Date.now()}` };
    this.savePurchaseOrders([...list, newItem]);
    return newItem;
  },
  savePurchaseOrder(
    record: (Omit<PurchaseOrderRecord, "id"> & { id?: string }) | PurchaseOrderRecord,
  ): PurchaseOrderRecord {
    const list = this.getPurchaseOrders();
    if (record.id) {
      const idx = list.findIndex((po) => po.id === record.id);
      if (idx >= 0) {
        const updated = { ...list[idx], ...record } as PurchaseOrderRecord;
        const nextList = [...list];
        nextList[idx] = updated;
        this.savePurchaseOrders(nextList);
        return updated;
      }
    }
    const newPO: PurchaseOrderRecord = {
      ...record,
      id: record.id || `po-${Date.now()}`,
      orderNumber: record.orderNumber || `PO-${Date.now().toString().slice(-6)}`,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: (record.status as PurchaseOrderRecord["status"]) || "DRAFT",
      items: record.items || [],
      totalQuantity:
        record.totalQuantity ??
        (record.items ? record.items.reduce((s, it) => s + (it.quantity || 0), 0) : 0),
      totalCost:
        record.totalCost ??
        (record.items
          ? record.items.reduce(
              (s, it) => s + (it.total || (it.costPrice || 0) * (it.quantity || 0)),
              0,
            )
          : 0),
    };
    this.savePurchaseOrders([newPO, ...list]);
    return newPO;
  },
  updatePurchaseOrder(id: string, updates: Partial<PurchaseOrderRecord>) {
    const list = this.getPurchaseOrders().map((po) => (po.id === id ? { ...po, ...updates } : po));
    this.savePurchaseOrders(list);
  },
  updatePurchaseOrderStatus(
    id: string,
    status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED",
  ): void {
    const list = this.getPurchaseOrders();
    const updated = list.map((po) =>
      po.id === id ? { ...po, status, updatedAt: new Date().toISOString() } : po,
    );
    this.savePurchaseOrders(updated);
  },
  deletePurchaseOrder(id: string) {
    const deleted = safeGet<string[]>(STORAGE_KEYS.DELETED_PO_IDS, []);
    if (!deleted.includes(id)) {
      safeSet(STORAGE_KEYS.DELETED_PO_IDS, [...deleted, id]);
    }
    const list = this.getPurchaseOrders().filter((po) => po.id !== id);
    this.savePurchaseOrders(list);
    return true;
  },
  receivePurchaseOrderIntoStock(
    poId: string,
    operator: string = "ผู้ดูแลระบบ",
  ): { success: boolean; message?: string; error?: string } {
    const po = this.getPurchaseOrderById(poId);
    if (!po) {
      return { success: false, error: "ไม่พบใบสั่งซื้อ" };
    }
    if (po.status === "RECEIVED") {
      return { success: false, error: "ใบสั่งซื้อนี้ได้ถูกตรวจรับเข้าสต็อกไปแล้ว" };
    }
    const allProds = this.getProducts();
    const movementsToAdd: Omit<StockMovementLog, "id">[] = [];
    const updatedProds = allProds.map((prod) => {
      const matchItem = po.items.find(
        (it) => it.productId === prod.id || it.barcode === prod.barcode,
      );
      if (matchItem && matchItem.quantity > 0) {
        const prevStock = prod.stock || 0;
        const newStock = prevStock + matchItem.quantity;
        movementsToAdd.push({
          timestamp: new Date().toISOString(),
          productId: prod.id,
          productName: prod.name,
          barcode: prod.barcode,
          type: "RECEIVE",
          quantity: matchItem.quantity,
          previousStock: prevStock,
          newStock,
          operator,
          note: `ตรวจรับเข้าสต็อกตามใบสั่งซื้อ ${po.orderNumber}`,
        });
        return {
          ...prod,
          stock: newStock,
          updatedAt: new Date().toISOString(),
        };
      }
      return prod;
    });

    this.saveProducts(updatedProds);
    for (const mov of movementsToAdd) {
      this.addMovement(mov);
    }
    this.updatePurchaseOrderStatus(poId, "RECEIVED");
    return {
      success: true,
      message: `ตรวจรับสินค้าตามใบสั่งซื้อ ${po.orderNumber} (${po.items.length} รายการ, ${po.totalQuantity} ชิ้น) เข้าสต็อกเรียบร้อยแล้ว`,
    };
  },

  syncDatabaseSnapshot(data: {
    products?: ProductItem[];
    categories?: CategoryItem[];
    subCategories?: SubCategoryItem[];
    zones?: ZoneItem[];
    units?: UnitItem[];
    receives?: ReceiveItem[];
    followers?: LineUserFollower[];
    movements?: StockMovementLog[];
    purchaseOrders?: PurchaseOrderRecord[];
  }): void {
    if (!data || typeof window === "undefined") return;
    try {
      isApplyingServerSnapshot = true;
      if (Array.isArray(data.units) && data.units.length > 0) {
        localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(data.units));
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
      }
      if (Array.isArray(data.subCategories) && data.subCategories.length > 0) {
        localStorage.setItem(STORAGE_KEYS.SUBCATEGORIES, JSON.stringify(data.subCategories));
      }
      if (Array.isArray(data.zones) && data.zones.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(data.zones));
      }
      if (Array.isArray(data.products) && data.products.length > 0) {
        const localList = safeGet<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []);
        const pendingDeleted = new Set(getPendingDeletedProducts());
        const localMap = new Map(localList.map((p) => [p.id, p]));
        const merged = data.products
          .filter((serverP) => !pendingDeleted.has(serverP.id))
          .map((serverP) => {
            const localP = localMap.get(serverP.id);
            if (!localP) return serverP;
            return {
              ...serverP,
              ...localP,
              stock: Math.max(Number(serverP.stock) || 0, Number(localP.stock) || 0),
              name: localP.name || serverP.name,
              categoryId: localP.categoryId || serverP.categoryId,
              subCategoryId: localP.subCategoryId || serverP.subCategoryId,
              zoneId: localP.zoneId || serverP.zoneId,
              unitId: localP.unitId || serverP.unitId,
              costPrice: localP.costPrice ?? serverP.costPrice,
              sellPrice: localP.sellPrice ?? serverP.sellPrice,
              minStock: localP.minStock ?? serverP.minStock,
              barcode: localP.barcode || serverP.barcode,
              sku: localP.sku || serverP.sku,
              updatedAt: localP.updatedAt || serverP.updatedAt,
            };
          });
        for (const lp of localList) {
          if (!merged.some((p) => p.id === lp.id) && !pendingDeleted.has(lp.id)) {
            merged.unshift(lp);
          }
        }
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
      }
      if (Array.isArray(data.purchaseOrders)) {
        localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(data.purchaseOrders));
      }
      if (Array.isArray(data.movements) && data.movements.length > 0) {
        localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(data.movements));
      }
      if (Array.isArray(data.receives) && data.receives.length > 0) {
        localStorage.setItem(STORAGE_KEYS.RECEIVES, JSON.stringify(data.receives));
      }
      if (Array.isArray(data.followers)) {
        localStorage.setItem(STORAGE_KEYS.FOLLOWERS, JSON.stringify(data.followers));
      }
      notifyStoreChange(STORAGE_KEYS.PRODUCTS);
    } finally {
      isApplyingServerSnapshot = false;
    }
  },
};

export function useMasterStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("minimark_store_change", handler);
    return () => window.removeEventListener("minimark_store_change", handler);
  }, []);
  return MasterStore;
}

export function useStoreName(): string {
  const [storeName, setStoreName] = useState(DEFAULT_STORE_NAME);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STORE_NAME);
      if (raw) setStoreName(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  return storeName;
}
