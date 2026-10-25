import { useEffect, useState, useCallback } from "react";
import {
  MasterStore,
  STORAGE_KEYS,
  type ProductItem,
  type ZoneItem,
  type CategoryItem,
  type SubCategoryItem,
  type UnitItem,
  type PurchaseOrderRecord,
  type StockMovementLog,
  type ReceiveItem,
  type LineUserFollower,
} from "@/lib/store";
import { syncMasterDatabaseFn } from "@/lib/line-server-fn";

/**
 * Custom hook to subscribe to real-time changes in MasterStore
 * across all tabs, windows, and store mutations.
 */
export function useRealtimeStore() {
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const syncWithDatabase = useCallback(async () => {
    try {
      const hasSavedZones = MasterStore.hasSavedZones();
      const hasSavedCategories =
        typeof window !== "undefined" && localStorage.getItem(STORAGE_KEYS.CATEGORIES) !== null;
      const hasSavedSubCategories =
        typeof window !== "undefined" && localStorage.getItem(STORAGE_KEYS.SUBCATEGORIES) !== null;
      const hasSavedUnits =
        typeof window !== "undefined" && localStorage.getItem(STORAGE_KEYS.UNITS) !== null;
      const hasSavedProducts =
        typeof window !== "undefined" && localStorage.getItem(STORAGE_KEYS.PRODUCTS) !== null;

      const res = await syncMasterDatabaseFn({
        data: {
          ...(hasSavedProducts ? { products: MasterStore.getProducts() } : {}),
          ...(hasSavedCategories ? { categories: MasterStore.getCategories() } : {}),
          ...(hasSavedSubCategories ? { subCategories: MasterStore.getSubCategories() } : {}),
          ...(hasSavedZones ? { zones: MasterStore.getZones() } : {}),
          ...(hasSavedUnits ? { units: MasterStore.getUnits() } : {}),
          receives: MasterStore.getReceives(),
          followers: MasterStore.getFollowers(),
          movements: MasterStore.getMovements(),
          purchaseOrders: MasterStore.getPurchaseOrders(),
          ...(MasterStore.getDeletedPurchaseOrderIds().length > 0
            ? { deletedPurchaseOrderIds: MasterStore.getDeletedPurchaseOrderIds() }
            : {}),
        },
      });
      if (res?.success && res.data) {
        MasterStore.syncDatabaseSnapshot(
          res.data as Parameters<typeof MasterStore.syncDatabaseSnapshot>[0],
        );
        refresh();
      }
      return res;
    } catch (err) {
      console.warn("DB sync notice:", err);
      return null;
    }
  }, [refresh]);

  useEffect(() => {
    const handleStoreChange = () => {
      refresh();
    };

    window.addEventListener("minimark_store_change", handleStoreChange);
    window.addEventListener("storage", handleStoreChange);

    return () => {
      window.removeEventListener("minimark_store_change", handleStoreChange);
      window.removeEventListener("storage", handleStoreChange);
    };
  }, [refresh]);

  return {
    version,
    refresh,
    syncWithDatabase,
    getProducts: useCallback(() => MasterStore.getProducts(), [version]),
    getZones: useCallback(() => MasterStore.getZones(), [version]),
    getCategories: useCallback(() => MasterStore.getCategories(), [version]),
    getUnits: useCallback(() => MasterStore.getUnits(), [version]),
    getPurchaseOrders: useCallback(() => MasterStore.getPurchaseOrders(), [version]),
    getMovements: useCallback(() => MasterStore.getMovements(), [version]),
    getReceives: useCallback(() => MasterStore.getReceives(), [version]),
  };
}
