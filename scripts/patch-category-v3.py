#!/usr/bin/env python3
"""v3: Always local-wins master fields on sync + persist category on PO items."""
from pathlib import Path
import re

sp = Path("src/lib/store.ts")
st = sp.read_text()

old_po_items = """  items: {
    productId: string;
    productName: string;
    barcode: string;
    quantity: number;
    unitName: string;
    unitId?: string | undefined;
    costPrice: number;
    total: number;
    note?: string | undefined;
  }[];"""

new_po_items = """  items: {
    productId: string;
    productName: string;
    barcode: string;
    quantity: number;
    unitName: string;
    unitId?: string | undefined;
    costPrice: number;
    total: number;
    note?: string | undefined;
    categoryId?: string | undefined;
    subCategoryId?: string | undefined;
    zoneId?: string | undefined;
  }[];"""

if old_po_items not in st:
    raise SystemExit("PO items type not found")
st = st.replace(old_po_items, new_po_items, 1)
print("PO item type ok")

m = re.search(
    r"if \(Array\.isArray\(data\.products\) && data\.products\.length > 0\) \{.*?localStorage\.setItem\(STORAGE_KEYS\.PRODUCTS, JSON\.stringify\(merged\)\);\n      \}",
    st,
    re.S,
)
if not m:
    m2 = re.search(
        r"if \(Array\.isArray\(data\.products\) && data\.products\.length > 0\) \{\n        localStorage\.setItem\(STORAGE_KEYS\.PRODUCTS, JSON\.stringify\(data\.products\)\);\n      \}",
        st,
    )
    if not m2:
        raise SystemExit("products sync block not found")
    old_block = m2.group(0)
else:
    old_block = m.group(0)

new_block = """if (Array.isArray(data.products) && data.products.length > 0) {
        // ALWAYS prefer local master-data (name/category/zone/unit/prices).
        // Server snapshot was reverting category right after edit when timestamps tied/unparseable.
        const localList = safeGet<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []);
        const localMap = new Map(localList.map((p) => [p.id, p]));
        const merged = data.products.map((serverP) => {
          const localP = localMap.get(serverP.id);
          if (!localP) return serverP;
          return {
            ...serverP,
            ...localP,
            stock: Math.max(Number(serverP.stock) || 0, Number(localP.stock) || 0),
            name: localP.name || serverP.name,
            categoryId: localP.categoryId || serverP.categoryId,
            subCategoryId: localP.subCategoryId || serverP.subCategoryId,
            zoneId: localP.zoneId || serverP.zoneId,
            unitId: localP.unitId || serverP.unitId,
            costPrice: localP.costPrice ?? serverP.costPrice,
            sellPrice: localP.sellPrice ?? serverP.sellPrice,
            minStock: localP.minStock ?? serverP.minStock,
            barcode: localP.barcode || serverP.barcode,
            sku: localP.sku || serverP.sku,
            updatedAt: localP.updatedAt || serverP.updatedAt,
          };
        });
        for (const lp of localList) {
          if (!merged.some((p) => p.id === lp.id)) merged.unshift(lp);
        }
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
      }"""

st = st.replace(old_block, new_block, 1)
print("local-wins merge ok")
sp.write_text(st)

rp = Path("src/routes/reorder.tsx")
rt = rp.read_text()

def patch_updated_items(src: str):
    pattern = re.compile(
        r"const updatedItems = orderList\.map\(\(item\) => \{\s*"
        r"const prod = allProds\.find\(\(p\) => p\.id === item\.productId\);\s*"
        r"return \{\s*"
        r"productId: item\.productId,\s*"
        r"productName: item\.productName \|\| prod\?\.name \|\| \"\"\s*,\s*"
        r"barcode: item\.barcode \|\| prod\?\.barcode(?: \|\| \"\")?,\s*"
        r"quantity: item\.quantity,\s*"
        r"unitId: item\.unitId,\s*"
        r"unitName:\s*(?:item\.unitName \|\| \(prod \? MasterStore\.getUnitName\(prod\.unitId\) : undefined\)|"
        r"\n\s*item\.unitName \|\| \(prod \? MasterStore\.getUnitName\(prod\.unitId\) : undefined\)),\s*"
        r"costPrice: item\.costPrice !== undefined \? item\.costPrice : prod\?\.costPrice \|\| 0,\s*"
        r"note: item\.note,\s*"
        r"\};\s*"
        r"\}\);",
        re.S,
    )
    replacement = """const updatedItems = orderList.map((item) => {
          const prod = allProds.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: item.productName || prod?.name || "",
            barcode: item.barcode || prod?.barcode || "",
            quantity: item.quantity,
            unitId: item.unitId,
            unitName: item.unitName || (prod ? MasterStore.getUnitName(prod.unitId) : undefined),
            costPrice: item.costPrice !== undefined ? item.costPrice : prod?.costPrice || 0,
            note: item.note,
            categoryId: item.categoryId || prod?.categoryId,
            subCategoryId: item.subCategoryId || prod?.subCategoryId,
            zoneId: item.zoneId || prod?.zoneId,
            total: (item.costPrice !== undefined ? item.costPrice : prod?.costPrice || 0) * item.quantity,
          };
        });"""
    return pattern.subn(replacement, src)

rt, n = patch_updated_items(rt)
print("updatedItems patterns patched:", n)

old_tab = """            const updatedItems = orderList.map((item) => {
              const prod = allProds.find((p) => p.id === item.productId);
              return {
                productId: item.productId,
                productName: item.productName || prod?.name || "",
                barcode: item.barcode || prod?.barcode,
                quantity: item.quantity,
                unitId: item.unitId,
                unitName:
                  item.unitName || (prod ? MasterStore.getUnitName(prod.unitId) : undefined),
                costPrice: item.costPrice !== undefined ? item.costPrice : prod?.costPrice || 0,
                note: item.note,
              };
            });"""

new_tab = """            const updatedItems = orderList.map((item) => {
              const prod = allProds.find((p) => p.id === item.productId);
              return {
                productId: item.productId,
                productName: item.productName || prod?.name || "",
                barcode: item.barcode || prod?.barcode || "",
                quantity: item.quantity,
                unitId: item.unitId,
                unitName:
                  item.unitName || (prod ? MasterStore.getUnitName(prod.unitId) : undefined),
                costPrice: item.costPrice !== undefined ? item.costPrice : prod?.costPrice || 0,
                note: item.note,
                categoryId: item.categoryId || prod?.categoryId,
                subCategoryId: item.subCategoryId || prod?.subCategoryId,
                zoneId: item.zoneId || prod?.zoneId,
                total: (item.costPrice !== undefined ? item.costPrice : prod?.costPrice || 0) * item.quantity,
              };
            });"""

if old_tab in rt:
    rt = rt.replace(old_tab, new_tab)
    print("tab-change updatedItems ok")
else:
    print("tab-change pattern already patched or missing")

old_load_cat = """              categoryId: matchedProd?.categoryId,
              subCategoryId: matchedProd?.subCategoryId,
              zoneId: matchedProd?.zoneId,"""

new_load_cat = """              categoryId: i.categoryId || matchedProd?.categoryId,
              subCategoryId: i.subCategoryId || matchedProd?.subCategoryId,
              zoneId: i.zoneId || matchedProd?.zoneId,"""

c = rt.count(old_load_cat)
if c:
    rt = rt.replace(old_load_cat, new_load_cat)
    print("load prefer PO category:", c)
else:
    old_trail = """              costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,
              note: i.note,
            };"""
    new_trail = """              costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,
              note: i.note,
              categoryId: (i as { categoryId?: string }).categoryId || matchedProd?.categoryId,
              subCategoryId: (i as { subCategoryId?: string }).subCategoryId || matchedProd?.subCategoryId,
              zoneId: (i as { zoneId?: string }).zoneId || matchedProd?.zoneId,
            };"""
    c2 = rt.count(old_trail)
    if c2:
        rt = rt.replace(old_trail, new_trail)
        print("load trail with PO category:", c2)
    else:
        print("WARNING: load category attach not found")

rp.write_text(rt)
print("DONE", rp.stat().st_size, sp.stat().st_size)
