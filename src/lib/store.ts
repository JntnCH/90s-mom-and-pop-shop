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
  }[];
  totalQuantity: number;
  totalCost: number;
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
  sentViaLineAt?: string | undefined;
}

export const DEFAULT_ZONES: ZoneItem[] = [
  {
    id: "zone-a",
    code: "Z-A",
    name: "โซน A (หน้าร้าน/เคาน์เตอร์)",
    description: "สินค้าขายดี ขนม บุหรี่",
  },
  {
    id: "zone-b",
    code: "Z-B",
    name: "โซน B (ชั้นกลาง อาหารแห้ง)",
    description: "บะหมี่สำเร็จรูป เครื่องปรุง ของแห้ง",
  },
  {
    id: "zone-c",
    code: "Z-C",
    name: "โซน C (ตู้แช่ เครื่องดื่ม)",
    description: "น้ำอัดลม นม น้ำดื่ม เบียร์",
  },
  {
    id: "zone-d",
    code: "Z-D",
    name: "โซน D (ของใช้ในบ้าน/ซักล้าง)",
    description: "ผงซักฟอก ยาสระผม สบู่",
  },
  {
    id: "zone-e",
    code: "Z-E",
    name: "โซน E (หลังร้าน/สต็อกสำรอง)",
    description: "กล่องสต็อกสำรอง",
  },
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
  {
    id: "sub-hsh-deter",
    categoryId: "cat-household",
    code: "DETR",
    name: "ผงซักฟอกและน้ำยาทำความสะอาด",
  },
  {
    id: "sub-hsh-tissue",
    categoryId: "cat-household",
    code: "TISS",
    name: "กระดาษทิชชู่และถุงขยะ",
  },
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
  PO_DRAFT: "minimark_po_draft",
  STORE_CONFIG: "minimark_store_config",
  STORE_NAME: "minimark_store_name",
};

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    // Purge mock demo products if user has not yet cleared them
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

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingServerSnapshot = false;

export function triggerCentralServerSync(immediate = false) {
  if (typeof window === "undefined" || isApplyingServerSnapshot) return;
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  const doSync = async () => {
    try {
      const { syncMasterDatabaseFn } = await import("./line-server-fn");
      const res = await syncMasterDatabaseFn({
        data: {
          products: MasterStore.getProducts(),
          categories: MasterStore.getCategories(),
          subCategories: MasterStore.getSubCategories(),
          zones: MasterStore.getZones(),
          units: MasterStore.getUnits(),
          receives: MasterStore.getReceives(),
          followers: MasterStore.getFollowers(),
          movements: MasterStore.getMovements(),
          purchaseOrders: MasterStore.getPurchaseOrders(),
        },
      });
      if (res?.success && res.data) {
        MasterStore.syncDatabaseSnapshot(
          res.data as Parameters<typeof MasterStore.syncDatabaseSnapshot>[0],
        );
      }
    } catch (err) {
      console.warn("[Store] Server sync notice:", err);
    }
  };

  if (immediate) {
    void doSync();
  } else {
    serverSyncTimer = setTimeout(doSync, 800);
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("minimark_store_change"));
    if (syncChannel) {
      syncChannel.postMessage({ type: "STORE_UPDATED", key, timestamp: Date.now() });
    }
    if (
      !isApplyingServerSnapshot &&
      (key === STORAGE_KEYS.PRODUCTS ||
        key === STORAGE_KEYS.CATEGORIES ||
        key === STORAGE_KEYS.SUBCATEGORIES ||
        key === STORAGE_KEYS.ZONES ||
        key === STORAGE_KEYS.UNITS)
    ) {
      triggerCentralServerSync();
    }
  } catch {
    // ignore
  }
}

export const MasterStore = {
  // Zones
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
    const list = this.getZones().filter((z) => z.id !== id);
    this.saveZones(list);
  },

  // Categories
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
            : generateCategoryCode(
                updated.name,
                list.filter((item) => item.id !== id),
              );
      }
      return updated;
    });
    this.saveCategories(list);
  },
  deleteCategory(id: string) {
    const list = this.getCategories().filter((c) => c.id !== id);
    this.saveCategories(list);
  },

  // SubCategories
  getSubCategories(categoryId?: string): SubCategoryItem[] {
    let list = safeGet<SubCategoryItem[]>(STORAGE_KEYS.SUBCATEGORIES, DEFAULT_SUBCATEGORIES);
    if ((!list || list.length === 0) && DEFAULT_SUBCATEGORIES.length > 0) {
      list = DEFAULT_SUBCATEGORIES;
      safeSet(STORAGE_KEYS.SUBCATEGORIES, DEFAULT_SUBCATEGORIES);
    }
    if (categoryId && categoryId !== "all" && categoryId !== "ALL") {
      return list.filter((s) => !s.categoryId || s.categoryId === categoryId);
    }
    return list;
  },
  saveSubCategories(items: SubCategoryItem[]) {
    safeSet(STORAGE_KEYS.SUBCATEGORIES, items);
  },
  saveSubCategory(item: SubCategoryItem) {
    const list = this.getSubCategories();
    const idx = list.findIndex((s) => s.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    this.saveSubCategories(list);
  },
  addSubCategory(item: Omit<SubCategoryItem, "id"> & { id?: string }): SubCategoryItem {
    const list = this.getSubCategories();
    const newItem: SubCategoryItem = {
      ...item,
      id: item.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    list.push(newItem);
    this.saveSubCategories(list);
    return newItem;
  },
  updateSubCategory(
    id: string,
    patch: Partial<Omit<SubCategoryItem, "id">>,
  ): SubCategoryItem | undefined {
    const list = this.getSubCategories();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return undefined;
    const updated: SubCategoryItem = { ...list[idx], ...patch };
    list[idx] = updated;
    this.saveSubCategories(list);
    return updated;
  },
  deleteSubCategory(id: string) {
    const list = this.getSubCategories().filter((s) => s.id !== id);
    this.saveSubCategories(list);
  },
  getSubCategoryName(subIdOrName?: string): string {
    if (!subIdOrName) return "-";
    const subs = this.getSubCategories();
    const matched = subs.find(
      (s) => s.id === subIdOrName || s.name === subIdOrName || s.code === subIdOrName,
    );
    return matched ? matched.name : subIdOrName;
  },

  // Units
  getUnits(): UnitItem[] {
    return safeGet<UnitItem[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  },
  getUnitName(unitIdOrName?: string): string {
    if (!unitIdOrName) return "ชิ้น";
    const units = this.getUnits();
    const matched = units.find(
      (u) =>
        u.id === unitIdOrName ||
        u.name === unitIdOrName ||
        u.shortName === unitIdOrName ||
        u.id.toLowerCase() === unitIdOrName.toLowerCase() ||
        u.name.toLowerCase() === unitIdOrName.toLowerCase(),
    );
    return matched ? matched.name : unitIdOrName;
  },
  getCategoryName(catIdOrName?: string): string {
    if (!catIdOrName) return "ทั่วไป";
    const cats = this.getCategories();
    const matched = cats.find(
      (c) => c.id === catIdOrName || c.name === catIdOrName || c.code === catIdOrName,
    );
    return matched ? matched.name : catIdOrName;
  },
  getZoneName(zoneIdOrName?: string): string {
    if (!zoneIdOrName) return "-";
    const zones = this.getZones();
    const matched = zones.find(
      (z) => z.id === zoneIdOrName || z.name === zoneIdOrName || z.code === zoneIdOrName,
    );
    return matched ? matched.name : zoneIdOrName;
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

  // Products
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
  addProduct(item: Omit<ProductItem, "id" | "createdAt" | "updatedAt"> & { createdAt?: string }) {
    const list = this.getProducts();
    const nowStr =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    const newItem: ProductItem = {
      ...item,
      id: `prod-${Date.now()}`,
      isActive: item.isActive !== undefined ? item.isActive : true,
      targetStock: Number(item.targetStock || item.reorderQuantity || 10),
      reorderQuantity: Number(item.reorderQuantity || item.targetStock || 10),
      createdAt: item.createdAt || nowStr,
      updatedAt: nowStr,
    };
    this.saveProducts([newItem, ...list]);
    return newItem;
  },
  updateProduct(id: string, updates: Partial<ProductItem>) {
    const nowStr =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    const list = this.getProducts().map((p) =>
      p.id === id
        ? {
            ...p,
            ...updates,
            targetStock:
              updates.targetStock !== undefined
                ? Number(updates.targetStock)
                : Number(updates.reorderQuantity ?? p.targetStock),
            updatedAt: nowStr,
          }
        : p,
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
    const list = this.getProducts().filter((p) => p.id !== id);
    this.saveProducts(list);
  },
  findByBarcode(code: string): ProductItem | undefined {
    const trimmed = code.trim();
    return this.getProducts().find((p) => p.barcode === trimmed);
  },

  // Stock Status and Alert Queries (Phase 4 & 5)
  getStockStatus(product: ProductItem): "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK" {
    if (product.stock <= 0) return "OUT_OF_STOCK";
    if (product.stock <= product.minStock) return "LOW_STOCK";
    return "NORMAL";
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
  getNormalStockProducts(): ProductItem[] {
    return this.getProducts().filter((p) => p.isActive !== false && p.stock > p.minStock);
  },

  /**
   * PHASE 5: Smart Reorder Calculation Engine
   * Strategy Options:
   * - "TARGET_PAR": Fill up to targetStock (Target Stock - Current Stock)
   * - "MINIMUM_RESTORE": Fill up to minStock + buffer (+20%)
   * - "WEEKEND_BUFFER": 1.5x buffer for weekend rush
   * - "DOUBLE_BUFFER": 2.0x buffer for long holiday or high demand
   */
  calculateSuggestedQuantity(
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

    // Default fallback if calculated is 0 but product is at/below minStock
    if (calculated <= 0 && current <= min) {
      calculated = Math.max(1, product.reorderQuantity || min);
    }

    return calculated;
  },

  getSmartReorderForecast(
    strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
    multiplier: number = 1.0,
  ) {
    const products = this.getReorderProducts();
    return products.map((p) => {
      const suggestedQty = this.calculateSuggestedQuantity(p, strategy, multiplier);
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
  },

  // Receives / Scans
  getReceives(): ReceiveItem[] {
    return safeGet<ReceiveItem[]>(STORAGE_KEYS.RECEIVES, []);
  },
  saveReceives(items: ReceiveItem[]) {
    safeSet(STORAGE_KEYS.RECEIVES, items);
  },
  addReceive(item: Omit<ReceiveItem, "id">) {
    const list = this.getReceives();
    const newItem: ReceiveItem = { ...item, id: `rec-${Date.now()}` };
    safeSet(STORAGE_KEYS.RECEIVES, [newItem, ...list]);
    return newItem;
  },
  clearReceives() {
    safeSet(STORAGE_KEYS.RECEIVES, []);
  },

  // Users & Bot Followers History
  getFollowers(): LineUserFollower[] {
    return removeLegacySampleLineFollowers(
      safeGet<LineUserFollower[]>(STORAGE_KEYS.FOLLOWERS, DEFAULT_FOLLOWERS),
    );
  },
  saveFollowers(items: LineUserFollower[]) {
    safeSet(STORAGE_KEYS.FOLLOWERS, removeLegacySampleLineFollowers(items));
  },
  saveFollower(user: LineUserFollower) {
    const list = this.getFollowers();
    const existingIdx = list.findIndex((f) => f.userId === user.userId);
    let updated: LineUserFollower[];
    if (existingIdx >= 0) {
      updated = list.map((f) => (f.userId === user.userId ? { ...f, ...user } : f));
    } else {
      updated = [user, ...list];
    }
    safeSet(STORAGE_KEYS.FOLLOWERS, updated);
  },

  // Stock Movement History
  getMovements(): StockMovementLog[] {
    return safeGet<StockMovementLog[]>(STORAGE_KEYS.MOVEMENTS, DEFAULT_MOVEMENTS);
  },
  saveMovements(items: StockMovementLog[]) {
    safeSet(STORAGE_KEYS.MOVEMENTS, items);
  },
  addMovement(log: Omit<StockMovementLog, "id" | "timestamp">) {
    const list = this.getMovements();
    const now =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    const item: StockMovementLog = {
      ...log,
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
    };
    safeSet(STORAGE_KEYS.MOVEMENTS, [item, ...list]);
    return item;
  },
  clearMovements() {
    safeSet(STORAGE_KEYS.MOVEMENTS, []);
  },

  // High-level Inventory Operations with Automatic Audit Trail
  receiveStock(
    productIdentifier: string,
    quantity: number,
    operator: string = "พนักงานสต็อก",
    note?: string,
    productNameFallback?: string,
  ): { success: boolean; product?: ProductItem; movement?: StockMovementLog; error?: string } {
    if (quantity <= 0) return { success: false, error: "จำนวนรับเข้าต้องมากกว่า 0" };

    const products = this.getProducts();
    let target = products.find(
      (p) => p.id === productIdentifier || p.barcode === productIdentifier,
    );

    if (!target) {
      // Auto-register product if not yet in database so stock is preserved
      const defaultUnit = this.getUnits()[0]?.id || "ชิ้น";
      target = this.addProduct({
        name:
          productNameFallback ||
          (note?.includes("[") ? note.split("]")[1]?.trim() : undefined) ||
          `สินค้าใหม่ (${productIdentifier})`,
        barcode: productIdentifier,
        price: 0,
        costPrice: 0,
        stock: 0,
        minStock: 5,
        targetStock: 10,
        unitId: defaultUnit,
      });
    }

    const prevStock = Number(target.stock) || 0;
    const newStock = prevStock + Number(quantity);

    this.updateProduct(target.id, { stock: newStock });

    const movement = this.addMovement({
      productId: target.id,
      productName: target.name,
      barcode: target.barcode,
      type: "RECEIVE",
      quantity: Number(quantity),
      previousStock: prevStock,
      newStock,
      operator: operator || "พนักงานสต็อก",
      note: note || `รับสินค้าเข้าสต็อก +${quantity}`,
    });

    return { success: true, product: { ...target, stock: newStock }, movement };
  },

  issueStock(
    productIdentifier: string,
    quantity: number,
    operator: string = "แคชเชียร์/ผู้เบิก",
    note?: string,
  ): { success: boolean; product?: ProductItem; movement?: StockMovementLog; error?: string } {
    if (quantity <= 0) return { success: false, error: "จำนวนจ่ายออกต้องมากกว่า 0" };

    const products = this.getProducts();
    const target = products.find(
      (p) => p.id === productIdentifier || p.barcode === productIdentifier,
    );

    if (!target) return { success: false, error: "ไม่พบสินค้าในระบบ" };

    const prevStock = Number(target.stock) || 0;
    const newStock = Math.max(0, prevStock - Number(quantity));

    this.updateProduct(target.id, { stock: newStock });

    const movement = this.addMovement({
      productId: target.id,
      productName: target.name,
      barcode: target.barcode,
      type: "ISSUE",
      quantity: Number(quantity),
      previousStock: prevStock,
      newStock,
      operator: operator || "แคชเชียร์/ผู้เบิก",
      note: note || `จ่ายสินค้าออกจากสต็อก -${quantity}`,
    });

    return { success: true, product: { ...target, stock: newStock }, movement };
  },

  adjustStock(
    productIdentifier: string,
    newQuantity: number,
    operator: string = "ผู้ดูแลระบบ",
    reason: string = "ปรับปรุงยอดนับสต็อกจริง",
  ): { success: boolean; product?: ProductItem; movement?: StockMovementLog; error?: string } {
    const products = this.getProducts();
    const target = products.find(
      (p) => p.id === productIdentifier || p.barcode === productIdentifier,
    );

    if (!target) return { success: false, error: "ไม่พบสินค้าในระบบ" };

    const prevStock = Number(target.stock) || 0;
    const newStock = Math.max(0, Number(newQuantity));
    const delta = newStock - prevStock;

    this.updateProduct(target.id, { stock: newStock });

    const movement = this.addMovement({
      productId: target.id,
      productName: target.name,
      barcode: target.barcode,
      type: "ADJUST",
      quantity: Math.abs(delta),
      previousStock: prevStock,
      newStock,
      operator: operator || "ผู้ดูแลระบบ",
      note: reason || `ปรับยอดสต็อก (${delta >= 0 ? "+" : ""}${delta})`,
    });

    return { success: true, product: { ...target, stock: newStock }, movement };
  },

  // Purchase Orders (Phase 6 Management & Lifecycle)
  getDraftPurchaseOrder(): {
    orderList: {
      productId: string;
      quantity: number;
      unitId: string;
      costPrice?: number;
      note?: string;
    }[];
    supplierName: string;
    calculationStrategy?: string;
    savedAt?: string;
  } | null {
    return safeGet(STORAGE_KEYS.PO_DRAFT, null);
  },
  saveDraftPurchaseOrder(draft: {
    orderList: {
      productId: string;
      quantity: number;
      unitId: string;
      costPrice?: number;
      note?: string;
    }[];
    supplierName: string;
    calculationStrategy?: string;
  }): void {
    safeSet(STORAGE_KEYS.PO_DRAFT, {
      ...draft,
      savedAt: new Date().toISOString(),
    });
  },
  clearDraftPurchaseOrder(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEYS.PO_DRAFT);
      window.dispatchEvent(new Event("minimark_store_change"));
      if (syncChannel) {
        syncChannel.postMessage({
          type: "STORE_UPDATED",
          key: STORAGE_KEYS.PO_DRAFT,
          timestamp: Date.now(),
        });
      }
    } catch {
      // ignore
    }
  },
  getPurchaseOrders(): PurchaseOrderRecord[] {
    return safeGet<PurchaseOrderRecord[]>(STORAGE_KEYS.PURCHASE_ORDERS, DEFAULT_PURCHASE_ORDERS);
  },
  savePurchaseOrders(items: PurchaseOrderRecord[]): void {
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, items);
  },
  getPurchaseOrderById(id: string): PurchaseOrderRecord | undefined {
    return this.getPurchaseOrders().find((po) => po.id === id);
  },
  savePurchaseOrder(
    order: Omit<PurchaseOrderRecord, "id" | "createdAt" | "orderNumber"> & {
      orderNumber?: string;
    },
  ): PurchaseOrderRecord {
    const list = this.getPurchaseOrders();
    const now =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    const d = new Date();
    const dateCode = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const seq = String(list.length + 1).padStart(3, "0");
    const generatedOrderNum = order.orderNumber || `PO-${dateCode}-${seq}`;

    const newOrder: PurchaseOrderRecord = {
      ...order,
      orderNumber: generatedOrderNum,
      id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
    };
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, [newOrder, ...list]);
    return newOrder;
  },
  updatePurchaseOrder(
    id: string,
    updates: Partial<Omit<PurchaseOrderRecord, "id" | "orderNumber" | "createdAt">> & {
      orderNumber?: string;
      createdAt?: string;
    },
  ): PurchaseOrderRecord | undefined {
    const list = this.getPurchaseOrders();
    const target = list.find((p) => p.id === id);
    if (!target) return undefined;

    const updated: PurchaseOrderRecord = {
      ...target,
      ...updates,
      id: target.id, // Guarantee ID is preserved
      orderNumber: updates.orderNumber || target.orderNumber, // Guarantee orderNumber is preserved
      createdAt: updates.createdAt || target.createdAt, // Guarantee createdAt is preserved
    };
    const nextList = list.map((p) => (p.id === id ? updated : p));
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, nextList);
    return updated;
  },
  updatePurchaseOrderStatus(
    id: string,
    status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED",
    extra?: { sentViaLineAt?: string },
  ): PurchaseOrderRecord | undefined {
    const list = this.getPurchaseOrders();
    const target = list.find((p) => p.id === id);
    if (!target) return undefined;

    const updated: PurchaseOrderRecord = {
      ...target,
      status,
      ...(extra?.sentViaLineAt ? { sentViaLineAt: extra.sentViaLineAt } : {}),
    };
    const nextList = list.map((p) => (p.id === id ? updated : p));
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, nextList);
    return updated;
  },
  deletePurchaseOrder(id: string): boolean {
    const list = this.getPurchaseOrders();
    const nextList = list.filter((p) => p.id !== id);
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, nextList);
    return true;
  },
  receivePurchaseOrderIntoStock(
    poId: string,
    operator: string = "พนักงานตรวจรับสินค้า",
  ): { success: boolean; movements?: StockMovementLog[]; error?: string } {
    const po = this.getPurchaseOrderById(poId);
    if (!po) return { success: false, error: "ไม่พบใบสั่งซื้อสินค้าในระบบ" };
    if (po.status === "RECEIVED") {
      return { success: false, error: "ใบสั่งซื้อนี้ได้รับการตรวจรับเข้าสต็อกแล้ว" };
    }

    const createdMovements: StockMovementLog[] = [];

    // Receive each item into stock and create movement logs
    po.items.forEach((item) => {
      const res = this.receiveStock(
        item.productId,
        item.quantity,
        operator,
        `ตรวจรับสินค้าตามใบสั่งซื้อ ${po.orderNumber}`,
      );
      if (res.movement) {
        createdMovements.push(res.movement);
      }
    });

    // Mark PO as RECEIVED
    this.updatePurchaseOrderStatus(poId, "RECEIVED");

    return { success: true, movements: createdMovements };
  },

  /**
   * Clear all mock / sample data to start with 100% clean real store database
   */
  clearAllMockData(): void {
    if (typeof window === "undefined") return;
    safeSet(STORAGE_KEYS.PRODUCTS, []);
    safeSet(STORAGE_KEYS.MOVEMENTS, []);
    safeSet(STORAGE_KEYS.PURCHASE_ORDERS, []);
    safeSet(STORAGE_KEYS.RECEIVES, []);
    try {
      localStorage.removeItem(STORAGE_KEYS.PO_DRAFT);
      localStorage.setItem("minimark_print_jobs_v1", JSON.stringify([]));
    } catch {
      // ignore
    }
  },

  /**
   * Get current store name with fallback to DEFAULT_STORE_NAME ("โชห่วยยุค90s")
   */
  getStoreName(): string {
    if (typeof window === "undefined") return DEFAULT_STORE_NAME;
    try {
      const explicitName = localStorage.getItem(STORAGE_KEYS.STORE_NAME);
      if (explicitName && explicitName.trim() && !isLegacyStoreName(explicitName)) {
        return explicitName.trim();
      }
      const rawCfg = localStorage.getItem(STORAGE_KEYS.STORE_CONFIG);
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        if (
          parsed?.storeName &&
          typeof parsed.storeName === "string" &&
          parsed.storeName.trim() &&
          !isLegacyStoreName(parsed.storeName)
        ) {
          return parsed.storeName.trim();
        }
      }
      const rawReceipt = localStorage.getItem("minimark_receipt_config_v1");
      if (rawReceipt) {
        const parsed = JSON.parse(rawReceipt);
        if (
          parsed?.storeName &&
          typeof parsed.storeName === "string" &&
          parsed.storeName.trim() &&
          !isLegacyStoreName(parsed.storeName)
        ) {
          return parsed.storeName.trim();
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_STORE_NAME;
  },

  /**
   * Set and save store name across the app
   */
  setStoreName(name: string): void {
    const trimmed = name.trim() || DEFAULT_STORE_NAME;
    safeSet(STORAGE_KEYS.STORE_NAME, trimmed);
    const profile = this.getStoreProfile();
    this.setStoreProfile({ ...profile, storeName: trimmed });
  },

  /**
   * Get full store profile config
   */
  getStoreProfile(): StoreProfileConfig {
    const saved = safeGet<StoreProfileConfig>(STORAGE_KEYS.STORE_CONFIG, DEFAULT_STORE_PROFILE);
    const storeName = this.getStoreName();
    return {
      ...DEFAULT_STORE_PROFILE,
      ...saved,
      storeName,
    };
  },

  /**
   * Set full store profile config and sync with receipt & templates
   */
  setStoreProfile(profile: Partial<StoreProfileConfig>): StoreProfileConfig {
    const current = this.getStoreProfile();
    const storeName = profile.storeName?.trim() || current.storeName || DEFAULT_STORE_NAME;
    const updated: StoreProfileConfig = {
      ...current,
      ...profile,
      storeName,
    };
    safeSet(STORAGE_KEYS.STORE_CONFIG, updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEYS.STORE_NAME, storeName);
        const rawReceipt = localStorage.getItem("minimark_receipt_config_v1");
        if (rawReceipt) {
          const parsed = JSON.parse(rawReceipt);
          parsed.storeName = storeName;
          if (profile.branchName) parsed.branchName = profile.branchName;
          if (profile.taxId) parsed.taxId = profile.taxId;
          if (profile.address) parsed.address = profile.address;
          if (profile.phone) parsed.phone = profile.phone;
          if (profile.headerMessage) parsed.headerMessage = profile.headerMessage;
          if (profile.footerMessage) parsed.footerMessage = profile.footerMessage;
          localStorage.setItem("minimark_receipt_config_v1", JSON.stringify(parsed));
        }
      } catch {
        // ignore
      }
    }
    window.dispatchEvent(new Event("minimark_store_change"));
    return updated;
  },

  /**
   * Sync complete database snapshot received from server into local store
   */
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
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
      }
      if (Array.isArray(data.receives) && data.receives.length > 0) {
        localStorage.setItem(STORAGE_KEYS.RECEIVES, JSON.stringify(data.receives));
      }
      if (Array.isArray(data.followers) && data.followers.length > 0) {
        localStorage.setItem(STORAGE_KEYS.FOLLOWERS, JSON.stringify(data.followers));
      }
      if (Array.isArray(data.movements) && data.movements.length > 0) {
        localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(data.movements));
      }
      if (Array.isArray(data.purchaseOrders) && data.purchaseOrders.length > 0) {
        localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(data.purchaseOrders));
      }
      window.dispatchEvent(new Event("minimark_store_change"));
      if (syncChannel) {
        syncChannel.postMessage({ type: "STORE_UPDATED", key: "ALL", timestamp: Date.now() });
      }
    } finally {
      isApplyingServerSnapshot = false;
    }
  },
};

function isLegacyStoreName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed === "MiniMark" ||
    trimmed === "ร้าน MiniMark" ||
    trimmed === "ร้าน MiniMark (มินิมาร์ท โชว์ห่วย)" ||
    trimmed === "ร้าน โชห่วยยุค 90s"
  );
}

/**
 * Reactive React hook that returns the current store name and re-renders
 * whenever the store name is updated in Settings.
 */
export function useStoreName(): string {
  const [storeName, setStoreNameState] = useState<string>(() => MasterStore.getStoreName());

  useEffect(() => {
    const update = () => {
      setStoreNameState(MasterStore.getStoreName());
    };
    update();
    window.addEventListener("minimark_store_change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("minimark_store_change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return storeName;
}
