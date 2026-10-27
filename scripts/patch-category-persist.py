#!/usr/bin/env python3
"""Minimal Change: persist category/zone on PO cart items + safe product merge on sync."""
from pathlib import Path

rp = Path("src/routes/reorder.tsx")
text = rp.read_text()

old_cart = """  interface OrderCartItem {
    productId: string;
    productName?: string | undefined;
    barcode?: string | undefined;
    quantity: number;
    unitId: string;
    unitName?: string | undefined;
    costPrice?: number | undefined;
    note?: string | undefined;
  }"""

new_cart = """  interface OrderCartItem {
    productId: string;
    productName?: string | undefined;
    barcode?: string | undefined;
    quantity: number;
    unitId: string;
    unitName?: string | undefined;
    costPrice?: number | undefined;
    note?: string | undefined;
    /** Snapshot on cart so list UI keeps category/zone even if products state lags */
    categoryId?: string | undefined;
    subCategoryId?: string | undefined;
    zoneId?: string | undefined;
  }"""

if old_cart not in text:
    raise SystemExit("OrderCartItem block not found")
text = text.replace(old_cart, new_cart, 1)

old_quick = """    setOrderList((prev) => [
      {
        productId: newProd.id,
        productName: newProd.name,
        barcode: newProd.barcode,
        quantity: qty,
        unitId: newProd.unitId,
        unitName: MasterStore.getUnitName(newProd.unitId),
        costPrice: newProd.costPrice,
      },
      ...prev,
    ]);"""

new_quick = """    setOrderList((prev) => [
      {
        productId: newProd.id,
        productName: newProd.name,
        barcode: newProd.barcode,
        quantity: qty,
        unitId: newProd.unitId,
        unitName: MasterStore.getUnitName(newProd.unitId),
        costPrice: newProd.costPrice,
        categoryId: newProd.categoryId,
        subCategoryId: newProd.subCategoryId,
        zoneId: newProd.zoneId,
      },
      ...prev,
    ]);"""

if old_quick not in text:
    raise SystemExit("quick-add setOrderList block not found")
text = text.replace(old_quick, new_quick, 1)

old_edit_list = """    // 1. Update in current order list
    setOrderList((prev) =>
      prev.map((item) => {
        if (item.productId === editingCartItem.productId) {
          return {
            ...item,
            productName: name,
            barcode: barcode,
            quantity: qty,
            unitId: editingCartItem.unitId,
            unitName: getUnitName(editingCartItem.unitId),
            costPrice: cost,
            note: note || undefined,
          };
        }
        return item;
      }),
    );"""

new_edit_list = """    // 1. Update in current order list (include category/zone snapshot for list UI)
    setOrderList((prev) =>
      prev.map((item) => {
        if (item.productId === editingCartItem.productId) {
          return {
            ...item,
            productName: name,
            barcode: barcode,
            quantity: qty,
            unitId: editingCartItem.unitId,
            unitName: getUnitName(editingCartItem.unitId),
            costPrice: cost,
            note: note || undefined,
            categoryId: editingCartItem.categoryId,
            subCategoryId: editingCartItem.subCategoryId || undefined,
            zoneId: editingCartItem.zoneId || undefined,
          };
        }
        return item;
      }),
    );"""

if old_edit_list not in text:
    raise SystemExit("edit setOrderList block not found")
text = text.replace(old_edit_list, new_edit_list, 1)

old_full = """    const zoneName = zones.find((z) => z.id === effectiveProduct.zoneId)?.name;
    return {
      product: effectiveProduct,
      name: effectiveProduct.name,
      quantity: item.quantity,
      unitId: effectiveUnitId,
      unitName: effectiveUnitName,
      barcode: effectiveProduct.barcode,
      costPrice: effectiveCostPrice,
      priceEstimate: effectiveCostPrice * item.quantity,
      ...(item.note !== undefined ? { note: item.note } : {}),
      categoryId: effectiveProduct.categoryId,
      categoryName: getCatName(effectiveProduct.categoryId),
      ...(effectiveProduct.zoneId !== undefined ? { zoneId: effectiveProduct.zoneId } : {}),
      ...(zoneName !== undefined ? { zoneName } : {}),
    };
  });"""

new_full = """    // Prefer category/zone saved on the cart row (survives products-state lag / server overwrite)
    const resolvedCategoryId = item.categoryId || effectiveProduct.categoryId;
    const resolvedZoneId = item.zoneId || effectiveProduct.zoneId;
    const resolvedSubCategoryId = item.subCategoryId || effectiveProduct.subCategoryId;
    const productWithResolved: ProductItem = {
      ...effectiveProduct,
      categoryId: resolvedCategoryId,
      ...(resolvedSubCategoryId !== undefined ? { subCategoryId: resolvedSubCategoryId } : {}),
      ...(resolvedZoneId !== undefined ? { zoneId: resolvedZoneId } : {}),
    };
    const zoneName = zones.find((z) => z.id === productWithResolved.zoneId)?.name;
    return {
      product: productWithResolved,
      name: productWithResolved.name,
      quantity: item.quantity,
      unitId: effectiveUnitId,
      unitName: effectiveUnitName,
      barcode: productWithResolved.barcode,
      costPrice: effectiveCostPrice,
      priceEstimate: effectiveCostPrice * item.quantity,
      ...(item.note !== undefined ? { note: item.note } : {}),
      categoryId: productWithResolved.categoryId,
      categoryName: getCatName(productWithResolved.categoryId),
      ...(productWithResolved.zoneId !== undefined ? { zoneId: productWithResolved.zoneId } : {}),
      ...(zoneName !== undefined ? { zoneName } : {}),
    };
  });"""

if old_full not in text:
    raise SystemExit("fullItems block not found")
text = text.replace(old_full, new_full, 1)
rp.write_text(text)
print("reorder.tsx patched OK", rp.stat().st_size)

sp = Path("src/lib/store.ts")
st = sp.read_text()

old_sync = """      if (Array.isArray(data.products) && data.products.length > 0) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
      }"""

new_sync = """      if (Array.isArray(data.products) && data.products.length > 0) {
        // Merge by id: keep local fields when local updatedAt is newer or server omits category/zone
        const localList = safeGet<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []);
        const localMap = new Map(localList.map((p) => [p.id, p]));
        const merged = data.products.map((serverP) => {
          const localP = localMap.get(serverP.id);
          if (!localP) return serverP;
          const localTs = Date.parse(localP.updatedAt || "") || 0;
          const serverTs = Date.parse(serverP.updatedAt || "") || 0;
          if (localTs > serverTs) {
            return { ...serverP, ...localP };
          }
          return {
            ...localP,
            ...serverP,
            categoryId: serverP.categoryId || localP.categoryId,
            subCategoryId: serverP.subCategoryId || localP.subCategoryId,
            zoneId: serverP.zoneId || localP.zoneId,
          };
        });
        for (const lp of localList) {
          if (!merged.some((p) => p.id === lp.id)) merged.unshift(lp);
        }
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
      }"""

if old_sync not in st:
    raise SystemExit("sync products overwrite block not found")
st = st.replace(old_sync, new_sync, 1)
sp.write_text(st)
print("store.ts patched OK", sp.stat().st_size)
print("done")
