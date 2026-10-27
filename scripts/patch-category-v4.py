#!/usr/bin/env python3
"""v4: Fix handleEditPO load + handleSavePO strip + pending product patches."""
from pathlib import Path

rp = Path("src/routes/reorder.tsx")
rt = rp.read_text()

old_edit = """  const handleEditPO = (po: PurchaseOrderRecord) => {
    try {
      localStorage.setItem("minimark_active_editing_po_id", po.id);
    } catch {
      /* ignore */
    }
    setEditingPOId(po.id);
    setEditingPONumber(po.orderNumber);
    setEditingPOCreatedAt(po.createdAt);
    setEditingPOStatus(po.status);
    setSupplierNameInput(po.supplierName || "");

    const loadedItems: OrderCartItem[] = po.items.map((i) => {
      const matchedProd = products.find((p) => p.id === i.productId);
      const matchedUnit = units.find((u) => u.name === i.unitName);
      return {
        productId: i.productId,
        productName: i.productName || matchedProd?.name,
        barcode: i.barcode || matchedProd?.barcode,
        quantity: Math.max(1, i.quantity || 1),
        unitId: i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || "unit-piece",
        unitName: i.unitName || (matchedProd ? getUnitName(matchedProd.unitId) : undefined),
        costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,
        note: i.note,
      };
    });

    setOrderList(loadedItems);
    setHasRestoredDraft(false);
    setLastAutoSavedAt(new Date());
    setActiveTab("create_po");
    toast.info(`กำลังแก้ไขใบสั่งซื้อ ${po.orderNumber}`);
  };"""

new_edit = """  const handleEditPO = (po: PurchaseOrderRecord) => {
    try {
      localStorage.setItem("minimark_active_editing_po_id", po.id);
    } catch {
      /* ignore */
    }
    setEditingPOId(po.id);
    setEditingPONumber(po.orderNumber);
    setEditingPOCreatedAt(po.createdAt);
    setEditingPOStatus(po.status);
    setSupplierNameInput(po.supplierName || "");

    // Always read latest master data (React state may lag after category edits)
    const allProds = MasterStore.getProducts();
    const loadedItems: OrderCartItem[] = po.items.map((i) => {
      const matchedProd =
        allProds.find((p) => p.id === i.productId) || products.find((p) => p.id === i.productId);
      const matchedUnit = units.find((u) => u.name === i.unitName);
      return {
        productId: i.productId,
        productName: i.productName || matchedProd?.name,
        barcode: i.barcode || matchedProd?.barcode,
        quantity: Math.max(1, i.quantity || 1),
        unitId: i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || "unit-piece",
        unitName: i.unitName || (matchedProd ? getUnitName(matchedProd.unitId) : undefined),
        costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,
        note: i.note,
        // Prefer values saved on the PO item, then product master
        categoryId: i.categoryId || matchedProd?.categoryId,
        subCategoryId: i.subCategoryId || matchedProd?.subCategoryId,
        zoneId: i.zoneId || matchedProd?.zoneId,
      };
    });

    setOrderList(loadedItems);
    setProducts(allProds);
    setHasRestoredDraft(false);
    setLastAutoSavedAt(new Date());
    setActiveTab("create_po");
    toast.info(`กำลังแก้ไขใบสั่งซื้อ ${po.orderNumber}`);
  };"""

if old_edit not in rt:
    raise SystemExit("handleEditPO block not found")
rt = rt.replace(old_edit, new_edit, 1)
print("handleEditPO ok")

old_save_edit = """        items: fullItems.map((f) => ({
          productId: f.product.id,
          productName: f.product.name,
          barcode: f.product.barcode,
          quantity: f.quantity,
          unitName: f.unitName,
          unitId: f.unitId,
          costPrice: f.costPrice,
          total: f.priceEstimate,
          note: f.note,
        })),
        totalQuantity,
        totalCost,
        status,
        sentViaLineAt:
          status === "ORDERED"
            ? new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH")
            : undefined,
      });"""

new_save_edit = """        items: fullItems.map((f) => ({
          productId: f.product.id,
          productName: f.product.name,
          barcode: f.product.barcode,
          quantity: f.quantity,
          unitName: f.unitName,
          unitId: f.unitId,
          costPrice: f.costPrice,
          total: f.priceEstimate,
          note: f.note,
          categoryId: f.product.categoryId,
          subCategoryId: f.product.subCategoryId,
          zoneId: f.product.zoneId,
        })),
        totalQuantity,
        totalCost,
        status,
        sentViaLineAt:
          status === "ORDERED"
            ? new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH")
            : undefined,
      });"""

if old_save_edit not in rt:
    raise SystemExit("handleSavePO edit items map not found")
rt = rt.replace(old_save_edit, new_save_edit, 1)
print("handleSavePO edit ok")

old_save_create = """      items: fullItems.map((f) => ({
        productId: f.product.id,
        productName: f.product.name,
        barcode: f.product.barcode,
        quantity: f.quantity,
        unitName: f.unitName,
        unitId: f.unitId,
        costPrice: f.costPrice,
        total: f.priceEstimate,
        ...(f.note !== undefined ? { note: f.note } : {}),
      })),"""

new_save_create = """      items: fullItems.map((f) => ({
        productId: f.product.id,
        productName: f.product.name,
        barcode: f.product.barcode,
        quantity: f.quantity,
        unitName: f.unitName,
        unitId: f.unitId,
        costPrice: f.costPrice,
        total: f.priceEstimate,
        ...(f.note !== undefined ? { note: f.note } : {}),
        categoryId: f.product.categoryId,
        ...(f.product.subCategoryId !== undefined ? { subCategoryId: f.product.subCategoryId } : {}),
        ...(f.product.zoneId !== undefined ? { zoneId: f.product.zoneId } : {}),
      })),"""

c = rt.count(old_save_create)
if c == 0:
    print("WARNING: create save path not found")
else:
    rt = rt.replace(old_save_create, new_save_create)
    print("handleSavePO create:", c)

rp.write_text(rt)

sp = Path("src/lib/store.ts")
st = sp.read_text()

if "PENDING_PRODUCT_PATCHES_KEY" not in st:
    anchor = '  STORE_NAME: "minimark_store_name",\n};'
    if anchor not in st:
        raise SystemExit("STORAGE_KEYS end not found")
    st = st.replace(
        anchor,
        anchor + '\n\nconst PENDING_PRODUCT_PATCHES_KEY = "minimark_pending_product_patches";\n',
        1,
    )
    print("PENDING key ok")
else:
    print("PENDING key exists")

old_up = """  updateProduct(id: string, updates: Partial<ProductItem>) {
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
  },"""

new_up = """  updateProduct(id: string, updates: Partial<ProductItem>) {
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
    // Durable patch so server snapshots cannot wipe recent master-field edits
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(PENDING_PRODUCT_PATCHES_KEY);
        const patches: Record<string, Partial<ProductItem> & { _patchedAt?: string }> = raw
          ? JSON.parse(raw)
          : {};
        const prev = patches[id] || {};
        patches[id] = {
          ...prev,
          ...updates,
          updatedAt: nowStr,
          _patchedAt: nowStr,
        };
        localStorage.setItem(PENDING_PRODUCT_PATCHES_KEY, JSON.stringify(patches));
      }
    } catch {
      /* ignore */
    }
  },"""

if old_up not in st:
    raise SystemExit("updateProduct not found")
st = st.replace(old_up, new_up, 1)
print("updateProduct ok")

marker = "        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));"
if marker not in st:
    raise SystemExit("merged write marker not found")

apply_block = """        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
        // Re-apply recent local product master patches (category/zone/name/prices)
        try {
          const rawPatches = localStorage.getItem(PENDING_PRODUCT_PATCHES_KEY);
          if (rawPatches) {
            const patches: Record<string, Partial<ProductItem> & { _patchedAt?: string }> =
              JSON.parse(rawPatches);
            let changed = false;
            const nextList = safeGet<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []).map((p) => {
              const patch = patches[p.id];
              if (!patch) return p;
              changed = true;
              const { _patchedAt, ...fields } = patch;
              return {
                ...p,
                ...fields,
                ...(fields.categoryId ? { categoryId: fields.categoryId } : {}),
                ...(fields.subCategoryId !== undefined
                  ? { subCategoryId: fields.subCategoryId }
                  : {}),
                ...(fields.zoneId !== undefined ? { zoneId: fields.zoneId } : {}),
                ...(fields.name ? { name: fields.name } : {}),
                updatedAt: fields.updatedAt || p.updatedAt,
              };
            });
            if (changed) {
              localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextList));
            }
          }
        } catch {
          /* ignore */
        }"""

st = st.replace(marker, apply_block, 1)
print("re-apply patches ok")
sp.write_text(st)
print("DONE", rp.stat().st_size, sp.stat().st_size)
