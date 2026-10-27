#!/usr/bin/env python3
from pathlib import Path

p = Path("src/routes/reorder.tsx")
text = p.read_text()

old = """    // 2. Always update the product in MasterStore as well
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
    setProducts(MasterStore.getProducts());

    toast.success(`บันทึกข้อมูลสินค้า "${name}" และอัปเดตใบสั่งซื้อเรียบร้อยแล้ว`);
    setEditItemModalOpen(false);
  };"""

new = """    // 2. Always update the product in MasterStore as well
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
    });

    toast.success(`บันทึกข้อมูลสินค้า "${name}" และอัปเดตใบสั่งซื้อเรียบร้อยแล้ว`);
    setEditItemModalOpen(false);
  };"""

if old not in text:
    raise SystemExit("reorder block not found — abort")
p.write_text(text.replace(old, new, 1))
print("reorder patched", p.stat().st_size)
