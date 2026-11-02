#!/usr/bin/env python3
"""Inject getSmartReorderForecast + calculateSuggestedQuantity into MasterStore if missing."""
from pathlib import Path

p = Path("src/lib/store.ts")
text = p.read_text()

if "getSmartReorderForecast" in text and "calculateSuggestedQuantity" in text:
    print("forecast methods already present")
    raise SystemExit(0)

needle = """  getLowStockProducts(): ProductItem[] {
    return this.getProducts().filter(
      (p) => p.isActive !== false && p.stock > 0 && p.stock <= p.minStock,
    );
  },

  getReceives(): ReceiveItem[] {"""

insert = """  getLowStockProducts(): ProductItem[] {
    return this.getProducts().filter(
      (p) => p.isActive !== false && p.stock > 0 && p.stock <= p.minStock,
    );
  },
  getOutOfStockProducts(): ProductItem[] {
    return this.getProducts().filter((p) => p.isActive !== false && p.stock <= 0);
  },
  calculateSuggestedQuantity(
    product: ProductItem,
    strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
    customMultiplier: number = 1.0,
  ): number {
    const current = Math.max(0, product.stock || 0);
    const min = Math.max(1, product.minStock || 5);
    const target = Math.max(min, product.targetStock || product.reorderQuantity || min * 2);
    let calculated = 0;
    switch (strategy) {
      case "TARGET_PAR":
        calculated = Math.max(0, target - current);
        break;
      case "MINIMUM_RESTORE":
        calculated = Math.max(1, min + Math.ceil(min * 0.2) - current);
        break;
      case "WEEKEND_BUFFER":
        calculated = Math.max(1, Math.ceil((target - current) * 1.5));
        break;
      case "DOUBLE_BUFFER":
        calculated = Math.max(1, Math.ceil((target - current) * 2.0));
        break;
    }
    if (customMultiplier > 0 && customMultiplier !== 1.0) {
      calculated = Math.max(1, Math.ceil(calculated * customMultiplier));
    }
    if (calculated <= 0 && current <= min) {
      calculated = Math.max(1, product.reorderQuantity || min);
    }
    return calculated;
  },
  getSmartReorderForecast(
    strategy: "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER" = "TARGET_PAR",
    multiplier: number = 1.0,
  ) {
    const products = this.getReorderProducts();
    return products.map((p) => {
      const suggestedQty = this.calculateSuggestedQuantity(p, strategy, multiplier);
      const isOutOfStock = p.stock <= 0;
      const urgency = isOutOfStock
        ? ("HIGH" as const)
        : p.stock <= Math.ceil(p.minStock * 0.5)
          ? ("HIGH" as const)
          : ("MEDIUM" as const);
      const estimatedCost = (p.costPrice || 0) * suggestedQty;
      return {
        product: p,
        currentStock: p.stock,
        minStock: p.minStock,
        targetStock: p.targetStock || p.reorderQuantity || p.minStock * 2,
        suggestedQuantity: suggestedQty,
        estimatedCost,
        urgency,
        isOutOfStock,
      };
    });
  },

  getReceives(): ReceiveItem[] {"""

if needle not in text:
    raise SystemExit("needle not found for forecast inject — check store.ts structure")

text = text.replace(needle, insert, 1)
p.write_text(text)

if "checkDuplicateSku" not in text:
    raise SystemExit("checkDuplicateSku missing after inject")
if "getSmartReorderForecast" not in text:
    raise SystemExit("getSmartReorderForecast missing after inject")

print("injected getSmartReorderForecast + calculateSuggestedQuantity")
print("store.ts bytes", len(text))
