#!/usr/bin/env python3
"""Complete unitName sync for PO cart, load, export, flex — one shot."""
from pathlib import Path
import re

path = Path("src/routes/reorder.tsx")
text = path.read_text()
print("size", len(text))
if len(text) < 100000:
    raise SystemExit("reorder.tsx too small")

changes = 0

# 1) handleUpdateUnit — set unitName with unitId
old1 = """  const handleUpdateUnit = (productId: string, unitId: string) => {
    setOrderList((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, unitId } : item)),
    );
  };"""
new1 = """  const handleUpdateUnit = (productId: string, unitId: string) => {
    setOrderList((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, unitId, unitName: getUnitName(unitId) }
          : item,
      ),
    );
  };"""
if old1 in text:
    text = text.replace(old1, new1, 1)
    changes += 1
    print("+ handleUpdateUnit")
elif "unitName: getUnitName(unitId)" in text:
    print("= handleUpdateUnit already fixed")
else:
    pat = re.compile(
        r"const handleUpdateUnit = \(productId: string, unitId: string\) => \{\s*"
        r"setOrderList\(\(prev\) =>\s*"
        r"prev\.map\(\(item\) =>\s*"
        r"(?:item\.productId === productId\s*"
        r"\? \{ \.\.\.item, unitId \}\s*"
        r": item,?\s*"
        r"|\(item\.productId === productId \? \{ \.\.\.item, unitId \} : item\))\s*"
        r"\),?\s*"
        r"\);?\s*"
        r"\};",
        re.M,
    )
    repl = """const handleUpdateUnit = (productId: string, unitId: string) => {
    setOrderList((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, unitId, unitName: getUnitName(unitId) }
          : item,
      ),
    );
  };"""
    text2, n = pat.subn(repl, text, count=1)
    if n:
        text = text2
        changes += 1
        print("+ handleUpdateUnit (regex)")
    else:
        print("! handleUpdateUnit skip")

# 2) fullItems effectiveUnitName
old2 = """    const effectiveUnitId = item.unitId || product?.unitId || units[0]?.id || \"unit-piece\";
    const effectiveUnitName = item.unitName || getUnitName(effectiveUnitId);"""
new2 = """    const effectiveUnitId = item.unitId || product?.unitId || units[0]?.id || \"unit-piece\";
    // unitId is source of truth (inline dropdown); always resolve name so export/preview stay in sync
    const effectiveUnitName = getUnitName(effectiveUnitId) || item.unitName || \"-\";"""
if old2 in text:
    text = text.replace(old2, new2, 1)
    changes += 1
    print("+ fullItems effectiveUnitName")
elif "getUnitName(effectiveUnitId) || item.unitName" in text:
    print("= fullItems already fixed")
else:
    print("! fullItems skip")

# 3) getPurchaseOrderFlexItems
old3 = """      name: item.productName,
      quantity: item.quantity,
      unitName: item.unitName,"""
new3 = """      name: item.productName,
      quantity: item.quantity,
      unitName:
        (item.unitId ? MasterStore.getUnitName(item.unitId) : \"\") ||
        item.unitName ||
        (product ? MasterStore.getUnitName(product.unitId) : \"-\"),"""
idx = text.find("function getPurchaseOrderFlexItems")
if idx >= 0 and old3 in text[idx : idx + 800]:
    text = text[:idx] + text[idx:].replace(old3, new3, 1)
    changes += 1
    print("+ getPurchaseOrderFlexItems")
elif "item.unitId ? MasterStore.getUnitName(item.unitId)" in text:
    print("= getPurchaseOrderFlexItems already fixed")
else:
    print("! getPurchaseOrderFlexItems skip")

# 4) activePO load — do not let product default unit overwrite saved unitName
old4 = """              unitId: i.unitId || matchedProd?.unitId || \"unit-piece\",
              unitName:
                MasterStore.getUnitName(i.unitId || matchedProd?.unitId || \"unit-piece\") ||
                i.unitName ||
                (matchedProd ? MasterStore.getUnitName(matchedProd.unitId) : undefined),"""
new4 = """              unitId:
                i.unitId ||
                (i.unitName
                  ? MasterStore.getUnits().find((u) => u.name === i.unitName || u.shortName === i.unitName)?.id
                  : undefined) ||
                matchedProd?.unitId ||
                \"unit-piece\",
              unitName:
                (i.unitId ? MasterStore.getUnitName(i.unitId) : undefined) ||
                i.unitName ||
                MasterStore.getUnitName(
                  i.unitId || matchedProd?.unitId || \"unit-piece\",
                ) ||
                (matchedProd ? MasterStore.getUnitName(matchedProd.unitId) : undefined),"""
if old4 in text:
    text = text.replace(old4, new4, 1)
    changes += 1
    print("+ activePO load")
elif "u.shortName === i.unitName" in text:
    print("= activePO already fixed")
else:
    print("! activePO skip")

# 5) handleEditPO load — prefer matchedUnit (from unitName) over product unitId
old5 = """        unitId: i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || \"unit-piece\",
        unitName:
          getUnitName(i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || \"unit-piece\") ||
          i.unitName ||
          (matchedProd ? getUnitName(matchedProd.unitId) : undefined),"""
new5 = """        unitId: i.unitId || matchedUnit?.id || matchedProd?.unitId || units[0]?.id || \"unit-piece\",
        unitName:
          (i.unitId ? getUnitName(i.unitId) : undefined) ||
          i.unitName ||
          getUnitName(i.unitId || matchedUnit?.id || matchedProd?.unitId || units[0]?.id || \"unit-piece\") ||
          (matchedProd ? getUnitName(matchedProd.unitId) : undefined),"""
if old5 in text:
    text = text.replace(old5, new5, 1)
    changes += 1
    print("+ handleEditPO load")
elif "i.unitId || matchedUnit?.id || matchedProd?.unitId" in text:
    print("= handleEditPO already fixed")
else:
    print("! handleEditPO skip")

# 6) handleOpenExportPO unitName from unitId
pat6 = re.compile(
    r"(items: po\.items\.map\(\(i\) => \{[\s\S]{0,400}?)unitName: i\.unitName,",
)

def repl6(m):
    return (
        m.group(1)
        + 'unitName: (i.unitId ? getUnitName(i.unitId) : undefined) || i.unitName || (p ? getUnitName(p.unitId) : "-"),'
    )

text2, n6 = pat6.subn(repl6, text, count=1)
if n6:
    text = text2
    changes += 1
    print("+ handleOpenExportPO")
elif "i.unitId ? getUnitName(i.unitId)" in text:
    print("= handleOpenExportPO already fixed")
else:
    print("! handleOpenExportPO skip")

path.write_text(text)
print("changes", changes)
print("final size", path.stat().st_size)
print("DONE")
