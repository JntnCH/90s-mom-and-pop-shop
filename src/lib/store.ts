/**
 * Master Data & Application Store
 * Stores Zones, Categories, Units, Products, and Orders with persistence.
 */

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
  // เครื่องดื่ม (cat-beverage)
  { id: "sub-bev-soft", categoryId: "cat-beverage", code: "SOFT", name: "น้ำอัดลม/น้ำหวาน" },
  { id: "sub-bev-water", categoryId: "cat-beverage", code: "WAT", name: "น้ำดื่ม/น้ำแร่" },
  { id: "sub-bev-milk", categoryId: "cat-beverage", code: "MLK", name: "นม/โยเกิร์ต" },
  { id: "sub-bev-coffee", categoryId: "cat-beverage", code: "COF", name: "กาแฟ/ชาพร้อมดื่ม" },
  { id: "sub-bev-alc", categoryId: "cat-beverage", code: "ALC", name: "เบียร์/สุรา/แอลกอฮอล์" },

  // ขนมขบเคี้ยว (cat-snack)
  { id: "sub-snk-potato", categoryId: "cat-snack", code: "POT", name: "มันฝรั่งทอด/ขนมกรอบ" },
  { id: "sub-snk-biscuit", categoryId: "cat-snack", code: "BIS", name: "บิสกิต/คุกกี้/เวเฟอร์" },
  { id: "sub-snk-candy", categoryId: "cat-snack", code: "CND", name: "ลูกอม/หมากฝรั่ง" },
  { id: "sub-snk-bakery", categoryId: "cat-snack", code: "BKY", name: "ขนมปัง/เบเกอรี่" },

  // อาหารสำเร็จรูปและแห้ง (cat-food)
  { id: "sub-fod-noodle", categoryId: "cat-food", code: "NDL", name: "บะหมี่/เส้นกึ่งสำเร็จรูป" },
  { id: "sub-fod-canned", categoryId: "cat-food", code: "CAN", name: "ปลากระป๋อง/อาหารกระป๋อง" },
  { id: "sub-fod-sauce", categoryId: "cat-food", code: "SAU", name: "เครื่องปรุงรส/ซอส" },
  { id: "sub-fod-rice", categoryId: "cat-food", code: "RIC", name: "ข้าวสาร/อาหารแห้ง" },

  // ของใช้ในครัวเรือน (cat-household)
  {
    id: "sub-hsh-detergent",
    categoryId: "cat-household",
    code: "DET",
    name: "น้ำยาซักผ้า/ผงซักฟอก",
  },
  {
    id: "sub-hsh-cleaning",
    categoryId: "cat-household",
    code: "CLN",
    name: "น้ำยาล้างจาน/ทำความสะอาด",
  },
  { id: "sub-hsh-tissue", categoryId: "cat-household", code: "TIS", name: "กระดาษทิชชู่/ถุงขยะ" },

  // ของใช้ส่วนตัว (cat-personal)
  { id: "sub-per-soap", categoryId: "cat-personal", code: "SOAP", name: "สบู่/ครีมอาบน้ำ" },
  { id: "sub-per-shampoo", categoryId: "cat-personal", code: "SHMP", name: "ยาสระผม/ครีมนวด" },
  { id: "sub-per-oral", categoryId: "cat-personal", code: "ORAL", name: "ยาสีฟัน/แปรงสีฟัน" },

  // สินค้าเบ็ดเตล็ด (cat-general)
  { id: "sub-gen-tobacco", categoryId: "cat-general", code: "TOB", name: "บุหรี่/ยาสูบ" },
  { id: "sub-gen-misc", categoryId: "cat-general", code: "MSC", name: "ของใช้เบ็ดเตล็ดทั่วไป" },
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

export const DEFAULT_MOVEMENTS: StockMovementLog[] = [
  {
    id: "mov-1",
    timestamp: "2026-09-24 14:30",
    productId: "prod-1",
    productName: "มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง 55g",
    barcode: "8850124001153",
    type: "RECEIVE",
    quantity: 20,
    previousStock: 8,
    newStock: 28,
    operator: "พนักงานสต็อก (Staff Store)",
    note: "รับสินค้าเข้าจาก ซัพพลายเออร์ A",
  },
  {
    id: "mov-2",
    timestamp: "2026-09-24 16:15",
    productId: "prod-1",
    productName: "มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง 55g",
    barcode: "8850124001153",
    type: "ISSUE",
    quantity: 20,
    previousStock: 28,
    newStock: 8,
    operator: "แคชเชียร์หน้าร้าน",
    note: "ขายหน้าร้าน",
  },
  {
    id: "mov-3",
    timestamp: "2026-09-24 17:00",
    productId: "prod-2",
    productName: "โค้ก น้ำอัดลม ออริจินัล 325ml",
    barcode: "8851717001018",
    type: "RECEIVE",
    quantity: 24,
    previousStock: 5,
    newStock: 29,
    operator: "พนักงานสต็อก (Staff Store)",
    note: "ตรวจรับสินค้าประจำสัปดาห์",
  },
];

export const DEFAULT_PURCHASE_ORDERS: PurchaseOrderRecord[] = [
  {
    id: "po-101",
    orderNumber: "PO-20260924-001",
    createdAt: "2026-09-24 10:30 น.",
    supplierName: "บริษัท ยูนิลีเวอร์ / ไทยน้ำทิพย์ จำกัด",
    items: [
      {
        productId: "prod-1",
        productName: "มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง 55g",
        barcode: "8850124001153",
        quantity: 30,
        unitName: "ซอง",
        costPrice: 6.0,
        total: 180.0,
      },
      {
        productId: "prod-2",
        productName: "โค้ก น้ำอัดลม ออริจินัล 325ml",
        barcode: "8851717001018",
        quantity: 24,
        unitName: "กระป๋อง",
        costPrice: 12.0,
        total: 288.0,
      },
    ],
    totalQuantity: 54,
    totalCost: 468.0,
    status: "ORDERED",
    sentViaLineAt: "2026-09-24 10:32 น.",
  },
];

export const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: "prod-1",
    sku: "SKU-FOD-001",
    barcode: "8850124001153",
    codeType: "Barcode",
    format: "EAN_13",
    name: "มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง 55g",
    imageUrl:
      "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=150&auto=format&fit=crop&q=60",
    categoryId: "cat-food",
    subCategoryId: "sub-fod-noodle",
    zoneId: "zone-b",
    unitId: "unit-bag",
    costPrice: 6.0,
    sellPrice: 7.0,
    stock: 8,
    minStock: 20,
    targetStock: 30,
    reorderQuantity: 30,
    isActive: true,
    createdAt: "2026-09-20 09:00",
    updatedAt: "2026-09-23 10:00",
  },
  {
    id: "prod-2",
    sku: "SKU-BEV-001",
    barcode: "8851717001018",
    codeType: "Barcode",
    format: "EAN_13",
    name: "โค้ก น้ำอัดลม ออริจินัล 325ml",
    imageUrl:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=150&auto=format&fit=crop&q=60",
    categoryId: "cat-beverage",
    subCategoryId: "sub-bev-soft",
    zoneId: "zone-c",
    unitId: "unit-can",
    costPrice: 12.0,
    sellPrice: 15.0,
    stock: 5,
    minStock: 24,
    targetStock: 48,
    reorderQuantity: 48,
    isActive: true,
    createdAt: "2026-09-20 09:15",
    updatedAt: "2026-09-23 10:15",
  },
  {
    id: "prod-3",
    sku: "SKU-SNK-001",
    barcode: "8850718801124",
    codeType: "Barcode",
    format: "EAN_13",
    name: "เลย์ มันฝรั่งแท้ทอดกรอบ รสคลาสสิค 42g",
    imageUrl:
      "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=150&auto=format&fit=crop&q=60",
    categoryId: "cat-snack",
    subCategoryId: "sub-snk-potato",
    zoneId: "zone-a",
    unitId: "unit-bag",
    costPrice: 17.5,
    sellPrice: 20.0,
    stock: 12,
    minStock: 15,
    targetStock: 20,
    reorderQuantity: 20,
    isActive: true,
    createdAt: "2026-09-20 09:30",
    updatedAt: "2026-09-23 11:00",
  },
  {
    id: "prod-4",
    sku: "SKU-BEV-002",
    barcode: "QR-WATER-CRYSTAL-600",
    codeType: "QR",
    format: "QR_CODE",
    name: "น้ำดื่มคริสตัล 600ml (แพ็ค 12 ขวด)",
    imageUrl:
      "https://images.unsplash.com/photo-1559839914-17aae19cec71?w=150&auto=format&fit=crop&q=60",
    categoryId: "cat-beverage",
    subCategoryId: "sub-bev-water",
    zoneId: "zone-c",
    unitId: "unit-pack",
    costPrice: 48.0,
    sellPrice: 60.0,
    stock: 3,
    minStock: 10,
    targetStock: 15,
    reorderQuantity: 15,
    isActive: true,
    createdAt: "2026-09-20 10:00",
    updatedAt: "2026-09-23 11:30",
  },
  {
    id: "prod-5",
    sku: "SKU-HSH-001",
    barcode: "8850029010045",
    codeType: "Barcode",
    format: "EAN_13",
    name: "บรีส เอกเซล ผงซักฟอก สูตรเข้มข้น 750g",
    imageUrl:
      "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=150&auto=format&fit=crop&q=60",
    categoryId: "cat-household",
    subCategoryId: "sub-hsh-detergent",
    zoneId: "zone-d",
    unitId: "unit-bag",
    costPrice: 72.0,
    sellPrice: 89.0,
    stock: 4,
    minStock: 8,
    targetStock: 12,
    reorderQuantity: 12,
    isActive: true,
    createdAt: "2026-09-20 10:30",
    updatedAt: "2026-09-23 12:00",
  },
];

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
};

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
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

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("minimark_store_change"));
    if (syncChannel) {
      syncChannel.postMessage({ type: "STORE_UPDATED", key, timestamp: Date.now() });
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
    const list = safeGet<SubCategoryItem[]>(STORAGE_KEYS.SUBCATEGORIES, DEFAULT_SUBCATEGORIES);
    if (categoryId && categoryId !== "all" && categoryId !== "ALL") {
      return list.filter((s) => !s.categoryId || s.categoryId === categoryId);
    }
    return list;
  },
  saveSubCategories(items: SubCategoryItem[]) {
    safeSet(STORAGE_KEYS.SUBCATEGORIES, items);
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
  ): { success: boolean; product?: ProductItem; movement?: StockMovementLog; error?: string } {
    if (quantity <= 0) return { success: false, error: "จำนวนรับเข้าต้องมากกว่า 0" };

    const products = this.getProducts();
    const target = products.find(
      (p) => p.id === productIdentifier || p.barcode === productIdentifier,
    );

    if (!target) return { success: false, error: "ไม่พบสินค้าในระบบ" };

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
};
