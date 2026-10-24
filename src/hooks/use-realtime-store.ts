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
        },
      });
      if (res?.success && res.data) {
        if (Array.isArray(res.data.units) && res.data.units.length > 0) {
          MasterStore.saveUnits(res.data.units as UnitItem[]);
        }
        if (Array.isArray(res.data.categories) && res.data.categories.length > 0) {
          MasterStore.saveCategories(res.data.categories as CategoryItem[]);
        }
        if (Array.isArray(res.data.subCategories) && res.data.subCategories.length > 0) {
          MasterStore.saveSubCategories(res.data.subCategories as SubCategoryItem[]);
        }
        if (Array.isArray(res.data.zones) && res.data.zones.length > 0) {
          MasterStore.saveZones(res.data.zones as ZoneItem[]);
        }
        if (Array.isArray(res.data.products) && res.data.products.length > 0) {
          MasterStore.saveProducts(res.data.products as ProductItem[]);
        }
        if (Array.isArray(res.data.followers) && res.data.followers.length > 0) {
          MasterStore.saveFollowers(res.data.followers as LineUserFollower[]);
        }
        if (Array.isArray(res.data.movements) && res.data.movements.length > 0) {
          MasterStore.saveMovements(res.data.movements as StockMovementLog[]);
        }
        if (Array.isArray(res.data.purchaseOrders) && res.data.purchaseOrders.length > 0) {
          MasterStore.savePurchaseOrders(res.data.purchaseOrders as PurchaseOrderRecord[]);
        }
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
