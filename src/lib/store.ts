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
  DELETED_PO_IDS: "minimark_deleted_po_ids",
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

const PENDING_DELETED_ZONES_KEY = "minimark_pending_deleted_zones";

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

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
let storeNotifyTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingServerSnapshot = false;
let isSyncInFlight = false;
/** Debounce server full-sync so button taps stay responsive on LIFF. */
const SERVER_SYNC_DEBOUNCE_MS = 2500;
/** Coalesce UI reload events from rapid localStorage writes. */
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
      // Queue one more pass after the in-flight sync finishes.
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
          units: MasterStore.getUnits(),
          // Cap large logs — keeps request small and UI responsive on mobile LIFF
          receives: allReceives.slice(-MAX_SYNC_RECEIVES),
          followers: MasterStore.getFollowers(),
          movements: allMovements.slice(-MAX_SYNC_MOVEMENTS),
          purchaseOrders: MasterStore.getPurchaseOrders(),
        },
      });
      if (res?.success && res.data) {
        if (deletedZoneIds.length > 0) {
          clearPendingDeletedZones(deletedZoneIds);
        }
        if (deletedPOIds.length > 0) {
          clearPendingDeletedPOs(deletedPOIds);
        }
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
    // Coalesce re-renders across all pages listening to minimark_store_change
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
