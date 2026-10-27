#!/usr/bin/env python3
"""Restore store.ts if truncated and apply LIFF lag reduction patch."""
from __future__ import annotations

from pathlib import Path
import urllib.request

GOOD_URL = (
    "https://raw.githubusercontent.com/JntnCH/90s-mom-and-pop-shop/"
    "32f99ffeae255d901269f4a335ac7d9d99de9a24/src/lib/store.ts"
)

OLD = r'''let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingServerSnapshot = false;

export function triggerCentralServerSync(immediate = false) {
  if (typeof window === "undefined" || isApplyingServerSnapshot) return;
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  const doSync = async () => {
    try {
      const { syncMasterDatabaseFn } = await import("./line-server-fn");
      const deletedZoneIds = getPendingDeletedZones();
      const deletedPOIds = safeGet<string[]>(STORAGE_KEYS.DELETED_PO_IDS, []);
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
          receives: MasterStore.getReceives(),
          followers: MasterStore.getFollowers(),
          movements: MasterStore.getMovements(),
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
'''

NEW = r'''let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
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
'''


def main() -> None:
    p = Path("src/lib/store.ts")
    text = p.read_text() if p.exists() else ""
    if (
        not p.exists()
        or len(text) < 20000
        or "PLACEHOLDER" in text
        or "export const MasterStore" not in text
        or "syncDatabaseSnapshot" not in text
    ):
        print("Restoring store.ts from known-good commit")
        text = urllib.request.urlopen(GOOD_URL, timeout=60).read().decode("utf-8")
        p.write_text(text)

    src = p.read_text()
    if "SERVER_SYNC_DEBOUNCE_MS" in src:
        print("store.ts already has perf patch")
        return
    if OLD not in src:
        print("WARNING: expected sync block not found — left as-is")
        return
    p.write_text(src.replace(OLD, NEW, 1))
    print("store.ts perf patch applied")


if __name__ == "__main__":
    main()
