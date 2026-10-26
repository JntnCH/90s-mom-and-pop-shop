#!/usr/bin/env python3
"""Restore products.tsx if truncated and guard sellPrice.toLocaleString."""
from __future__ import annotations

from pathlib import Path
import urllib.request

GOOD_URL = (
    "https://raw.githubusercontent.com/JntnCH/90s-mom-and-pop-shop/"
    "444f7a86c027a43e9e353431c14a7a9450fbabe1/src/routes/products.tsx"
)

HELPER = r'''
function money(n: unknown): string {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function money2(n: unknown): string {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

'''


def main() -> None:
    p = Path("src/routes/products.tsx")
    text = p.read_text() if p.exists() else ""
    if (
        (not p.exists())
        or len(text) < 5000
        or "PLACEHOLDER" in text
        or "createFileRoute" not in text
    ):
        print("Restoring products.tsx from known good commit")
        text = urllib.request.urlopen(GOOD_URL, timeout=60).read().decode("utf-8")
        p.write_text(text)

    src = p.read_text()
    if "function money(" not in src:
        src = src.replace(
            'export const Route = createFileRoute("/products")',
            HELPER + 'export const Route = createFileRoute("/products")',
        )

    reps = [
        ('฿{p.sellPrice.toLocaleString("th-TH")}', "฿{money(p.sellPrice)}"),
        (
            "`฿${product.costPrice.toLocaleString(\"th-TH\", { minimumFractionDigits: 2 })}`",
            "`฿${money2(product.costPrice)}`",
        ),
        (
            '฿{product.sellPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}',
            "฿{money2(product.sellPrice)}",
        ),
    ]
    for a, b in reps:
        src = src.replace(a, b)

    old_load = "setProducts(MasterStore.getProducts());"
    new_load = """setProducts(
      MasterStore.getProducts().map((p) => ({
        ...p,
        costPrice: typeof p.costPrice === "number" ? p.costPrice : Number(p.costPrice) || 0,
        sellPrice: typeof p.sellPrice === "number" ? p.sellPrice : Number(p.sellPrice) || 0,
        stock: typeof p.stock === "number" ? p.stock : Number(p.stock) || 0,
        minStock: typeof p.minStock === "number" ? p.minStock : Number(p.minStock) || 0,
        targetStock: typeof p.targetStock === "number" ? p.targetStock : Number(p.targetStock) || 0,
        reorderQuantity:
          typeof p.reorderQuantity === "number" ? p.reorderQuantity : Number(p.reorderQuantity) || 0,
      })),
    );"""
    if old_load in src and "Number(p.sellPrice)" not in src:
        src = src.replace(old_load, new_load, 1)

    p.write_text(src)
    print("products.tsx patched")
    if "sellPrice.toLocaleString" in src:
        print("WARNING: still has sellPrice.toLocaleString")
    else:
        print("OK: no unsafe sellPrice.toLocaleString")


if __name__ == "__main__":
    main()
