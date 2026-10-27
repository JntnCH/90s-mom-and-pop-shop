#!/usr/bin/env python3
"""One-shot: sync unitName when cart unit changes so export/preview match latest PO."""
from pathlib import Path
import re

path = Path("src/routes/reorder.tsx")
text = path.read_text()
print("size", len(text))
if len(text) < 100000:
    raise SystemExit("reorder.tsx too small — abort")

pat1 = re.compile(
    r"(const handleUpdateUnit = \(productId: string, unitId: string\) => \{\s*"
    r"setOrderList\(\(prev\) =>\s*"
    r"prev\.map\(\(item\) => \(item\.productId === productId \? \{ \.\.\.item, unitId \} : item\)\),\s*"
    r"\);\s*"
    r"\};)"
)
repl1 = """const handleUpdateUnit = (productId: string, unitId: string) => {
    setOrderList((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, unitId, unitName: getUnitName(unitId) }
          : item,
      ),
    );
  };"""
text2, n1 = pat1.subn(repl1, text, count=1)
print("handleUpdateUnit", n1)
if n1 != 1:
    raise SystemExit("failed handleUpdateUnit")

pat2 = re.compile(
    r"const effectiveUnitId = item\.unitId \|\| product\?\.unitId \|\| units\[0\]\?\.id \|\| \"unit-piece\";\n"
    r"\s*const effectiveUnitName = item\.unitName \|\| getUnitName\(effectiveUnitId\);"
)
repl2 = (
    'const effectiveUnitId = item.unitId || product?.unitId || units[0]?.id || "unit-piece";\n'
    '    // unitId is source of truth (inline dropdown); always resolve name so export/preview stay in sync\n'
    '    const effectiveUnitName = getUnitName(effectiveUnitId) || item.unitName || "-";'
)
text3, n2 = pat2.subn(repl2, text2, count=1)
print("effectiveUnitName", n2)
if n2 != 1:
    raise SystemExit("failed effectiveUnitName")

path.write_text(text3)
assert "unitName: getUnitName(unitId)" in text3
assert "getUnitName(effectiveUnitId) || item.unitName" in text3
print("OK", path.stat().st_size)
