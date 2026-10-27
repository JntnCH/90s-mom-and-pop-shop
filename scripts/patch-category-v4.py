#!/usr/bin/env python3
"""Complete unitName sync for PO cart/export — one-shot, idempotent where possible."""
from pathlib import Path
import re

path = Path("src/routes/reorder.tsx")
text = path.read_text()
orig_len = len(text)
if orig_len < 100000:
    raise SystemExit(f"reorder.tsx too small ({orig_len}) — abort")

changes = []

def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        if new in text or new.strip() in text:
            changes.append(f"skip (already): {label}")
            return
        raise SystemExit(f"MISSING: {label}")
    text = text.replace(old, new, 1)
    changes.append(label)

BAD_FALLBACK = (
    "unitName: item.unitName || (prod ? MasterStore.getUnitName(prod.unitId) : undefined),"
)
GOOD_FALLBACK = """unitName:
              MasterStore.getUnitName(item.unitId) ||
              item.unitName ||
              (prod ? MasterStore.getUnitName(prod.unitId) : undefined),"""

n_bad = text.count(BAD_FALLBACK)
if n_bad:
    text = text.replace(BAD_FALLBACK, GOOD_FALLBACK)
    changes.append(f"bad unitName fallback x{n_bad}")

replace_once(
    """        unitId: item.unitId,
        unitName: item.unitName,""",
    """        unitId: item.unitId,
        unitName: MasterStore.getUnitName(item.unitId) || item.unitName,""",
    "draft save unitName",
)

replace_once(
    """              unitId: i.unitId || matchedProd?.unitId || \"unit-piece\",
              unitName: i.unitName,
              costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,""",
    """              unitId: i.unitId || matchedProd?.unitId || \"unit-piece\",
              unitName:
                MasterStore.getUnitName(i.unitId || matchedProd?.unitId || \"unit-piece\") ||
                i.unitName ||
                (matchedProd ? MasterStore.getUnitName(matchedProd.unitId) : undefined),
              costPrice: i.costPrice !== undefined ? i.costPrice : matchedProd?.costPrice || 0,""",
    "load activePO unitName",
)

old_edit = """        unitId: i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || \"unit-piece\",
        unitName: i.unitName || (matchedProd ? getUnitName(matchedProd.unitId) : undefined),"""
new_edit = """        unitId: i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || \"unit-piece\",
        unitName:
          getUnitName(i.unitId || matchedProd?.unitId || matchedUnit?.id || units[0]?.id || \"unit-piece\") ||
          i.unitName ||
          (matchedProd ? getUnitName(matchedProd.unitId) : undefined),"""
replace_once(old_edit, new_edit, "handleEditPO unitName")

old_hu = """  const handleUpdateUnit = (productId: string, unitId: string) => {
    setOrderList((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, unitId } : item)),
    );
  };"""
new_hu = """  const handleUpdateUnit = (productId: string, unitId: string) => {
    setOrderList((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, unitId, unitName: getUnitName(unitId) }
          : item,
      ),
    );
  };"""
if old_hu in text:
    text = text.replace(old_hu, new_hu, 1)
    changes.append("handleUpdateUnit")
elif "unitName: getUnitName(unitId)" in text:
    changes.append("skip (already): handleUpdateUnit")
else:
    pat = re.compile(
        r"const handleUpdateUnit = \(productId: string, unitId: string\) => \{[\s\S]*?\n  \};"
    )
    m = pat.search(text)
    if m and "unitName: getUnitName(unitId)" not in m.group(0):
        text = pat.sub(new_hu, text, count=1)
        changes.append("handleUpdateUnit (regex)")
    else:
        changes.append("skip handleUpdateUnit")

old_fi = """    const effectiveUnitId = item.unitId || product?.unitId || units[0]?.id || \"unit-piece\";
    const effectiveUnitName = item.unitName || getUnitName(effectiveUnitId);"""
new_fi = """    const effectiveUnitId = item.unitId || product?.unitId || units[0]?.id || \"unit-piece\";
    // unitId is source of truth (inline dropdown); always resolve name so export/preview stay in sync
    const effectiveUnitName = getUnitName(effectiveUnitId) || item.unitName || \"-\";"""
if old_fi in text:
    text = text.replace(old_fi, new_fi, 1)
    changes.append("fullItems effectiveUnitName")
elif "getUnitName(effectiveUnitId) || item.unitName" in text:
    changes.append("skip (already): fullItems")
else:
    changes.append("WARN fullItems pattern missing")

old_add = """          i.productId === prodId
            ? {
                ...i,
                quantity: i.quantity + qty,
                unitId: uId,
                costPrice: cost,
                note: note || i.note,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: prodId,
          quantity: qty,
          unitId: uId,
          costPrice: cost,
          note: note || undefined,
        },
      ];
    });

    toast.success(
      `เพิ่ม "${prod.name}" (+${qty} ${getUnitName(uId)}) ลงในใบสั่งซื้อแล้ว` +"""
new_add = """          i.productId === prodId
            ? {
                ...i,
                quantity: i.quantity + qty,
                unitId: uId,
                unitName: getUnitName(uId),
                costPrice: cost,
                note: note || i.note,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: prodId,
          quantity: qty,
          unitId: uId,
          unitName: getUnitName(uId),
          costPrice: cost,
          note: note || undefined,
        },
      ];
    });

    toast.success(
      `เพิ่ม "${prod.name}" (+${qty} ${getUnitName(uId)}) ลงในใบสั่งซื้อแล้ว` +"""
replace_once(old_add, new_add, "handleAddManualItem unitName")

old_q = """      return [
        ...prev,
        {
          productId: prod.id,
          quantity: Math.max(1, addQty),
          unitId: uId,
          costPrice: cost,
        },
      ];
    });

    const currentItem = orderList.find((i) => i.productId === prod.id);"""
new_q = """      return [
        ...prev,
        {
          productId: prod.id,
          quantity: Math.max(1, addQty),
          unitId: uId,
          unitName: getUnitName(uId),
          costPrice: cost,
        },
      ];
    });

    const currentItem = orderList.find((i) => i.productId === prod.id);"""
replace_once(old_q, new_q, "quickAdd unitName")

old_b = """          updated.push({
            productId: prod.id,
            quantity: qty,
            unitId: uId,
            costPrice: cost,
          });"""
new_b = """          updated.push({
            productId: prod.id,
            quantity: qty,
            unitId: uId,
            unitName: getUnitName(uId),
            costPrice: cost,
          });"""
replace_once(old_b, new_b, "batch multi unitName")

old_f = """    const calculatedItems = listToApply.map((f) => ({
      productId: f.product.id,
      quantity: f.suggestedQuantity,
      unitId: f.product.unitId,
      costPrice: f.product.costPrice,
    }));
    setOrderList(calculatedItems);"""
new_f = """    const calculatedItems = listToApply.map((f) => ({
      productId: f.product.id,
      quantity: f.suggestedQuantity,
      unitId: f.product.unitId,
      unitName: getUnitName(f.product.unitId),
      costPrice: f.product.costPrice,
    }));
    setOrderList(calculatedItems);"""
replace_once(old_f, new_f, "forecast batch unitName")

old_sf = """        {
          productId: item.product.id,
          quantity: item.suggestedQuantity,
          unitId: item.product.unitId,
          costPrice: item.product.costPrice,
        },
      ];
    });
  };"""
new_sf = """        {
          productId: item.product.id,
          quantity: item.suggestedQuantity,
          unitId: item.product.unitId,
          unitName: getUnitName(item.product.unitId),
          costPrice: item.product.costPrice,
        },
      ];
    });
  };"""
replace_once(old_sf, new_sf, "forecast single unitName")

if "unitName: getUnitName(unitId)" not in text and "unitName: getUnitName(uId)" not in text:
    raise SystemExit("post-check: no unitName:getUnitName writes")
if BAD_FALLBACK in text:
    raise SystemExit("post-check: bad fallback still present")

path.write_text(text)
print("OK changes:")
for c in changes:
    print(" -", c)
print(f"size {orig_len} -> {len(text)}")
