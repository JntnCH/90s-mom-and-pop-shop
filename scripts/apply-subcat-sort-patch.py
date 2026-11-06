from pathlib import Path

p = Path("src/lib/line-service.ts")
data = p.read_text()
old = """export interface OrderFlexItem {
  name: string;
  quantity: number;
  unitName: string;
  barcode?: string | undefined;
  costPrice?: number | undefined;
  priceEstimate?: number | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  zoneId?: string | undefined;
  zoneName?: string | undefined;
  note?: string | undefined;
}"""
new = """export interface OrderFlexItem {
  name: string;
  quantity: number;
  unitName: string;
  barcode?: string | undefined;
  costPrice?: number | undefined;
  priceEstimate?: number | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  subCategoryId?: string | undefined;
  subCategoryName?: string | undefined;
  zoneId?: string | undefined;
  zoneName?: string | undefined;
  note?: string | undefined;
}"""
if old not in data:
    raise SystemExit("OrderFlexItem block not found")
data = data.replace(old, new, 1)
old2 = """    categoryId: item.categoryId || \"\",
    zoneId: item.zoneId || \"\","""
new2 = """    categoryId: item.categoryId || \"\",
    subCategoryId: item.subCategoryId || undefined,
    zoneId: item.zoneId || \"\","""
if old2 in data:
    data = data.replace(old2, new2, 1)
old3 = """    return {
      name: o.product.name,
      quantity: o.quantity,
      unitName: o.unitName,
      costPrice: o.product.costPrice,
      barcode: o.product.barcode,
      categoryId: o.product.categoryId,
      categoryName: catName,
      zoneId: o.product.zoneId,
      zoneName: zName,
    };"""
new3 = """    return {
      name: o.product.name,
      quantity: o.quantity,
      unitName: o.unitName,
      costPrice: o.product.costPrice,
      barcode: o.product.barcode,
      categoryId: o.product.categoryId,
      categoryName: catName,
      subCategoryId: o.product.subCategoryId,
      subCategoryName: o.product.subCategoryId
        ? MasterStore.getSubCategoryName(o.product.subCategoryId)
        : undefined,
      zoneId: o.product.zoneId,
      zoneName: zName,
    };"""
n = data.count(old3)
data = data.replace(old3, new3)
p.write_text(data)
print("line-service restored+patched", len(data), "map_replacements", n)

p = Path("src/routes/reorder.tsx")
data = p.read_text()
old = """function getPurchaseOrderFlexItems(po: PurchaseOrderRecord): OrderFlexItem[] {
  const products = MasterStore.getProducts();
  return po.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return {
      name: item.productName,
      quantity: item.quantity,
      unitName:
        (item.unitId ? MasterStore.getUnitName(item.unitId) : \"\") ||
        item.unitName ||
        (product ? MasterStore.getUnitName(product.unitId) : \"-\"),
      barcode: item.barcode,
      costPrice: item.costPrice,
      priceEstimate: item.total,
      categoryId: product?.categoryId ?? \"\",
      categoryName: product ? MasterStore.getCategoryName(product.categoryId) : \"หมวดหมู่ทั่วไป\",
      zoneId: product?.zoneId ?? \"\",
      zoneName: product?.zoneId ? MasterStore.getZoneName(product.zoneId) : \"-\",
      note: item.note,
    };
  });
}"""
new = """function getPurchaseOrderFlexItems(po: PurchaseOrderRecord): OrderFlexItem[] {
  const products = MasterStore.getProducts();
  return po.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const subCategoryId = item.subCategoryId || product?.subCategoryId;
    return {
      name: item.productName,
      quantity: item.quantity,
      unitName:
        (item.unitId ? MasterStore.getUnitName(item.unitId) : \"\") ||
        item.unitName ||
        (product ? MasterStore.getUnitName(product.unitId) : \"-\"),
      barcode: item.barcode,
      costPrice: item.costPrice,
      priceEstimate: item.total,
      categoryId: product?.categoryId ?? \"\",
      categoryName: product ? MasterStore.getCategoryName(product.categoryId) : \"หมวดหมู่ทั่วไป\",
      subCategoryId: subCategoryId,
      subCategoryName: subCategoryId
        ? MasterStore.getSubCategoryName(subCategoryId)
        : undefined,
      zoneId: product?.zoneId ?? \"\",
      zoneName: product?.zoneId ? MasterStore.getZoneName(product.zoneId) : \"-\",
      note: item.note,
    };
  });
}"""
if old not in data:
    print("WARNING: getPurchaseOrderFlexItems block not found — skip reorder")
else:
    p.write_text(data.replace(old, new, 1))
    print("reorder patched")
