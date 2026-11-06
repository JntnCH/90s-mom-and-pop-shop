from pathlib import Path

p = Path("src/lib/line-service.ts")
data = p.read_text()
old = (
    "export interface OrderFlexItem {\n"
    "  name: string;\n"
    "  quantity: number;\n"
    "  unitName: string;\n"
    "  barcode?: string | undefined;\n"
    "  costPrice?: number | undefined;\n"
    "  priceEstimate?: number | undefined;\n"
    "  categoryId?: string | undefined;\n"
    "  categoryName?: string | undefined;\n"
    "  zoneId?: string | undefined;\n"
    "  zoneName?: string | undefined;\n"
    "  note?: string | undefined;\n"
    "}"
)
new = (
    "export interface OrderFlexItem {\n"
    "  name: string;\n"
    "  quantity: number;\n"
    "  unitName: string;\n"
    "  barcode?: string | undefined;\n"
    "  costPrice?: number | undefined;\n"
    "  priceEstimate?: number | undefined;\n"
    "  categoryId?: string | undefined;\n"
    "  categoryName?: string | undefined;\n"
    "  subCategoryId?: string | undefined;\n"
    "  subCategoryName?: string | undefined;\n"
    "  zoneId?: string | undefined;\n"
    "  zoneName?: string | undefined;\n"
    "  note?: string | undefined;\n"
    "}"
)
if old not in data:
    raise SystemExit("OrderFlexItem block not found")
data = data.replace(old, new, 1)
old2 = '    categoryId: item.categoryId || "",\n    zoneId: item.zoneId || "",'
new2 = (
    '    categoryId: item.categoryId || "",\n'
    "    subCategoryId: item.subCategoryId || undefined,\n"
    '    zoneId: item.zoneId || "",'
)
if old2 in data:
    data = data.replace(old2, new2, 1)
old3 = (
    "    return {\n"
    "      name: o.product.name,\n"
    "      quantity: o.quantity,\n"
    "      unitName: o.unitName,\n"
    "      costPrice: o.product.costPrice,\n"
    "      barcode: o.product.barcode,\n"
    "      categoryId: o.product.categoryId,\n"
    "      categoryName: catName,\n"
    "      zoneId: o.product.zoneId,\n"
    "      zoneName: zName,\n"
    "    };"
)
new3 = (
    "    return {\n"
    "      name: o.product.name,\n"
    "      quantity: o.quantity,\n"
    "      unitName: o.unitName,\n"
    "      costPrice: o.product.costPrice,\n"
    "      barcode: o.product.barcode,\n"
    "      categoryId: o.product.categoryId,\n"
    "      categoryName: catName,\n"
    "      subCategoryId: o.product.subCategoryId,\n"
    "      subCategoryName: o.product.subCategoryId\n"
    "        ? MasterStore.getSubCategoryName(o.product.subCategoryId)\n"
    "        : undefined,\n"
    "      zoneId: o.product.zoneId,\n"
    "      zoneName: zName,\n"
    "    };"
)
n = data.count(old3)
data = data.replace(old3, new3)
p.write_text(data)
print("line-service restored+patched", len(data), "map_replacements", n)

p = Path("src/routes/reorder.tsx")
data = p.read_text()
old = (
    "function getPurchaseOrderFlexItems(po: PurchaseOrderRecord): OrderFlexItem[] {\n"
    "  const products = MasterStore.getProducts();\n"
    "  return po.items.map((item) => {\n"
    "    const product = products.find((candidate) => candidate.id === item.productId);\n"
    "    return {\n"
    "      name: item.productName,\n"
    "      quantity: item.quantity,\n"
    "      unitName:\n"
    '        (item.unitId ? MasterStore.getUnitName(item.unitId) : "") ||\n'
    "        item.unitName ||\n"
    '        (product ? MasterStore.getUnitName(product.unitId) : "-"),\n'
    "      barcode: item.barcode,\n"
    "      costPrice: item.costPrice,\n"
    "      priceEstimate: item.total,\n"
    '      categoryId: product?.categoryId ?? "",\n'
    '      categoryName: product ? MasterStore.getCategoryName(product.categoryId) : "หมวดหมู่ทั่วไป",\n'
    '      zoneId: product?.zoneId ?? "",\n'
    '      zoneName: product?.zoneId ? MasterStore.getZoneName(product.zoneId) : "-",\n'
    "      note: item.note,\n"
    "    };\n"
    "  });\n"
    "}"
)
new = (
    "function getPurchaseOrderFlexItems(po: PurchaseOrderRecord): OrderFlexItem[] {\n"
    "  const products = MasterStore.getProducts();\n"
    "  return po.items.map((item) => {\n"
    "    const product = products.find((candidate) => candidate.id === item.productId);\n"
    "    const subCategoryId = item.subCategoryId || product?.subCategoryId;\n"
    "    return {\n"
    "      name: item.productName,\n"
    "      quantity: item.quantity,\n"
    "      unitName:\n"
    '        (item.unitId ? MasterStore.getUnitName(item.unitId) : "") ||\n'
    "        item.unitName ||\n"
    '        (product ? MasterStore.getUnitName(product.unitId) : "-"),\n'
    "      barcode: item.barcode,\n"
    "      costPrice: item.costPrice,\n"
    "      priceEstimate: item.total,\n"
    '      categoryId: product?.categoryId ?? "",\n'
    '      categoryName: product ? MasterStore.getCategoryName(product.categoryId) : "หมวดหมู่ทั่วไป",\n'
    "      subCategoryId: subCategoryId,\n"
    "      subCategoryName: subCategoryId\n"
    "        ? MasterStore.getSubCategoryName(subCategoryId)\n"
    "        : undefined,\n"
    '      zoneId: product?.zoneId ?? "",\n'
    '      zoneName: product?.zoneId ? MasterStore.getZoneName(product.zoneId) : "-",\n'
    "      note: item.note,\n"
    "    };\n"
    "  });\n"
    "}"
)
if old not in data:
    print("WARNING: getPurchaseOrderFlexItems block not found — skip reorder")
else:
    p.write_text(data.replace(old, new, 1))
    print("reorder patched")
