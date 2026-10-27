#!/usr/bin/env python3
"""Fix category/zone persistence: ISO updatedAt, local-wins merge, draft keeps category fields."""
from pathlib import Path

sp = Path("src/lib/store.ts")
st = sp.read_text()

old_now = '''    const nowStr =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    const newItem: ProductItem = {
      ...item,
      id: `prod-${Date.now()}`,
      isActive: item.isActive !== undefined ? item.isActive : true,
      targetStock: Number(item.targetStock || item.reorderQuantity || 10),
      reorderQuantity: Number(item.reorderQuantity || item.targetStock || 10),
      createdAt: item.createdAt || nowStr,
      updatedAt: nowStr,
    };'''

new_now = '''    const nowStr = new Date().toISOString();
    const newItem: ProductItem = {
      ...item,
      id: `prod-${Date.now()}`,
      isActive: item.isActive !== undefined ? item.isActive : true,
      targetStock: Number(item.targetStock || item.reorderQuantity || 10),
      reorderQuantity: Number(item.reorderQuantity || item.targetStock || 10),
      createdAt: item.createdAt || nowStr,
      updatedAt: nowStr,
    };'''

if old_now in st:
    st = st.replace(old_now, new_now, 1)
    print("addProduct ISO ok")
elif "const nowStr = new Date().toISOString();" in st:
    print("addProduct already ISO")
else:
    raise SystemExit("addProduct nowStr not found")

old_upd = '''  updateProduct(id: string, updates: Partial<ProductItem>) {
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
  },'''

new_upd = '''  updateProduct(id: string, updates: Partial<ProductItem>) {
    const nowStr = new Date().toISOString();
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
  },'''

if old_upd in st:
    st = st.replace(old_upd, new_upd, 1)
    print("updateProduct ISO ok")
elif "updateProduct" in st and "toISOString()" in st:
    print("updateProduct already ISO-ish")
else:
    raise SystemExit("updateProduct block not found")

old_merge = '''      if (Array.isArray(data.products) && data.products.length > 0) {
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
      }'''

new_merge = '''      if (Array.isArray(data.products) && data.products.length > 0) {
        // Merge by id. Local master-data wins when local.updatedAt >= server (or equal/unparseable).
        // Prevents server snapshot from reverting category/zone right after a local edit.
        const localList = safeGet<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []);
        const localMap = new Map(localList.map((p) => [p.id, p]));
        const merged = data.products.map((serverP) => {
          const localP = localMap.get(serverP.id);
          if (!localP) return serverP;
          const localTs = Date.parse(String(localP.updatedAt || "")) || 0;
          const serverTs = Date.parse(String(serverP.updatedAt || "")) || 0;
          // Prefer local master fields when timestamps equal/unparseable OR local is newer
          if (localTs >= serverTs) {
            return {
              ...serverP,
              ...localP,
              stock: Math.max(Number(serverP.stock) || 0, Number(localP.stock) || 0),
            };
          }
          return {
            ...localP,
            ...serverP,
            name: serverP.name || localP.name,
            categoryId: serverP.categoryId || localP.categoryId,
            subCategoryId: serverP.subCategoryId || localP.subCategoryId,
            zoneId: serverP.zoneId || localP.zoneId,
            unitId: serverP.unitId || localP.unitId,
            stock: Math.max(Number(serverP.stock) || 0, Number(localP.stock) || 0),
          };
        });
        for (const lp of localList) {
          if (!merged.some((p) => p.id === lp.id)) merged.unshift(lp);
        }
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
      }'''

if old_merge not in st:
    raise SystemExit("merge block not found")
st = st.replace(old_merge, new_merge, 1)
print("merge ok")
sp.write_text(st)

rp = Path("src/routes/reorder.tsx")
rt = rp.read_text()

old_draft_map = '''      orderList: orderList.map(({ productId, quantity, unitId, costPrice, note }) => ({
        productId,
        quantity,
        unitId,
        ...(costPrice !== undefined ? { costPrice } : {}),
        ...(note !== undefined ? { note } : {}),
      })),'''

new_draft_map = '''      orderList: orderList.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        barcode: item.barcode,
        quantity: item.quantity,
        unitId: item.unitId,
        unitName: item.unitName,
        ...(item.costPrice !== undefined ? { costPrice: item.costPrice } : {}),
        ...(item.note !== undefined ? { note: item.note } : {}),
        ...(item.categoryId !== undefined ? { categoryId: item.categoryId } : {}),
        ...(item.subCategoryId !== undefined ? { subCategoryId: item.subCategoryId } : {}),
        ...(item.zoneId !== undefined ? { zoneId: item.zoneId } : {}),
      })),'''

if old_draft_map not in rt:
    raise SystemExit("draft map not found")
rt = rt.replace(old_draft_map, new_draft_map)
print("draft map ok")

old_trail = '''              costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,
              note: i.note,
            };'''
new_trail = '''              costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,
              note: i.note,
              categoryId: matchedProd?.categoryId,
              subCategoryId: matchedProd?.subCategoryId,
              zoneId: matchedProd?.zoneId,
            };'''
c = rt.count(old_trail)
if c == 0:
    print("WARNING: load trail not found")
else:
    rt = rt.replace(old_trail, new_trail)
    print("load trail patched", c)

old_low = '''        setOrderList(
          lowStockItems.map((p) => ({
            productId: p.id,
            productName: p.name,
            barcode: p.barcode,
            quantity: MasterStore.calculateSuggestedQuantity(
              p,
              calculationStrategy,
              customMultiplier,
            ),
            unitId: p.unitId,
            costPrice: p.costPrice,
          })),
        );'''
new_low = '''        setOrderList(
          lowStockItems.map((p) => ({
            productId: p.id,
            productName: p.name,
            barcode: p.barcode,
            quantity: MasterStore.calculateSuggestedQuantity(
              p,
              calculationStrategy,
              customMultiplier,
            ),
            unitId: p.unitId,
            costPrice: p.costPrice,
            categoryId: p.categoryId,
            subCategoryId: p.subCategoryId,
            zoneId: p.zoneId,
          })),
        );'''
if old_low in rt:
    rt = rt.replace(old_low, new_low)
    print("low stock ok")
else:
    print("WARNING low stock")

old_handler = '''  const handleSaveEditItem = () => {
    if (!editingCartItem) return;
    const qty = Math.max(1, Number(editingCartItem.quantity) || 1);
    const cost = Math.max(0, Number(editingCartItem.costPrice) || 0);
    const name = editingCartItem.productName.trim() || "สินค้า";
    const barcode = editingCartItem.barcode.trim() || generateStoreBarcode("EAN_13").barcode;
    const note = editingCartItem.note.trim();

    // 1. Update in current order list (include category/zone snapshot for list UI)
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
    );

    // 2. Always update the product in MasterStore as well
    MasterStore.updateProduct(editingCartItem.productId, {
      name,
      barcode,
      ...(editingCartItem.sku?.trim() ? { sku: editingCartItem.sku.trim() } : {}),
      costPrice: cost,
      sellPrice: Number(editingCartItem.sellPrice) || 0,
      minStock: Math.max(0, Number(editingCartItem.minStock) || 0),
      unitId: editingCartItem.unitId,
      categoryId: editingCartItem.categoryId,
      subCategoryId: editingCartItem.subCategoryId || undefined,
      zoneId: editingCartItem.zoneId || undefined,
    });

    // 3. Force UI list to reflect category/zone/name immediately
    setProducts((prev) => {
      const fromStore = MasterStore.getProducts();
      const base = fromStore.length > 0 ? fromStore : prev;
      return base.map((p) =>
        p.id === editingCartItem.productId
          ? {
              ...p,
              name,
              barcode,
              ...(editingCartItem.sku?.trim() ? { sku: editingCartItem.sku.trim() } : {}),
              costPrice: cost,
              sellPrice: Number(editingCartItem.sellPrice) || 0,
              minStock: Math.max(0, Number(editingCartItem.minStock) || 0),
              unitId: editingCartItem.unitId,
              categoryId: editingCartItem.categoryId,
              subCategoryId: editingCartItem.subCategoryId || undefined,
              zoneId: editingCartItem.zoneId || undefined,
            }
          : p,
      );
    });'''

new_handler = '''  const handleSaveEditItem = () => {
    if (!editingCartItem) return;
    const qty = Math.max(1, Number(editingCartItem.quantity) || 1);
    const cost = Math.max(0, Number(editingCartItem.costPrice) || 0);
    const name = editingCartItem.productName.trim() || "สินค้า";
    const barcode = editingCartItem.barcode.trim() || generateStoreBarcode("EAN_13").barcode;
    const note = editingCartItem.note.trim();
    const nextCategoryId = editingCartItem.categoryId || categories[0]?.id || "cat-general";
    const nextZoneId = editingCartItem.zoneId ? editingCartItem.zoneId : undefined;
    const nextSubCatId = editingCartItem.subCategoryId ? editingCartItem.subCategoryId : undefined;

    // 1. Update in current order list (include category/zone snapshot for list UI)
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
            categoryId: nextCategoryId,
            subCategoryId: nextSubCatId,
            zoneId: nextZoneId,
          };
        }
        return item;
      }),
    );

    // 2. Always update the product in MasterStore as well
    MasterStore.updateProduct(editingCartItem.productId, {
      name,
      barcode,
      ...(editingCartItem.sku?.trim() ? { sku: editingCartItem.sku.trim() } : {}),
      costPrice: cost,
      sellPrice: Number(editingCartItem.sellPrice) || 0,
      minStock: Math.max(0, Number(editingCartItem.minStock) || 0),
      unitId: editingCartItem.unitId,
      categoryId: nextCategoryId,
      subCategoryId: nextSubCatId,
      zoneId: nextZoneId,
    });

    // 3. Force UI list to reflect category/zone/name immediately
    setProducts((prev) => {
      const fromStore = MasterStore.getProducts();
      const base = fromStore.length > 0 ? fromStore : prev;
      return base.map((p) =>
        p.id === editingCartItem.productId
          ? {
              ...p,
              name,
              barcode,
              ...(editingCartItem.sku?.trim() ? { sku: editingCartItem.sku.trim() } : {}),
              costPrice: cost,
              sellPrice: Number(editingCartItem.sellPrice) || 0,
              minStock: Math.max(0, Number(editingCartItem.minStock) || 0),
              unitId: editingCartItem.unitId,
              categoryId: nextCategoryId,
              subCategoryId: nextSubCatId,
              zoneId: nextZoneId,
            }
          : p,
      );
    });'''

if old_handler not in rt:
    raise SystemExit("handleSaveEditItem not found")
rt = rt.replace(old_handler, new_handler, 1)
print("handleSaveEditItem ok")

rp.write_text(rt)
print("DONE", rp.stat().st_size, sp.stat().st_size)
