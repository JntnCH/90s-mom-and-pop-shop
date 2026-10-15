/**
 * Sales Analytics & Profit Margins Engine (Phase 13)
 * โชห่วยยุค90s Grocery & Retail Store Management
 */

import { MasterStore, type CategoryItem, type ProductItem, type StockMovementLog } from "./store";

export type TimeRangeFilter = "ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH";

export interface ProductSalesStat {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  categoryName: string;
  unitsSold: number;
  costPrice: number;
  sellPrice: number;
  unitProfit: number;
  marginPct: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  currentStock: number;
  status: "FAST_MOVING" | "NORMAL" | "SLOW_MOVING" | "DEAD_STOCK";
}

export interface CategorySalesStat {
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  unitsSold: number;
  totalRevenue: number;
  totalProfit: number;
  revenueSharePct: number;
  currentStockUnits: number;
  currentStockCostValue: number;
}

export interface SalesAnalyticsSummary {
  timeRange: TimeRangeFilter;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  profitMarginPct: number;
  totalUnitsSold: number;
  totalIssueTransactions: number;
  averageTransactionValue: number;

  // Inventory Health
  totalInventoryUnits: number;
  inventoryCostValue: number;
  inventoryRetailValue: number;
  inventoryPotentialProfit: number;

  // Segmentations
  topSellingProducts: ProductSalesStat[];
  highestProfitProducts: ProductSalesStat[];
  deadStockProducts: ProductSalesStat[];
  categoryBreakdown: CategorySalesStat[];

  // Trend by Date
  dailyTrends: { date: string; revenue: number; profit: number; units: number }[];
}

export const AnalyticsService = {
  /**
   * Filter movements based on the selected time range
   */
  filterMovements(movements: StockMovementLog[], range: TimeRangeFilter): StockMovementLog[] {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    return movements.filter((m) => {
      // Expecting timestamp like "2026-09-24 16:15" or similar ISO
      const itemDateStr = m.timestamp.slice(0, 10);

      if (range === "ALL") return true;

      if (range === "TODAY") {
        return (
          itemDateStr === todayStr ||
          m.timestamp.includes("25/09") ||
          m.timestamp.includes("2026-09-25")
        );
      }

      if (range === "THIS_WEEK") {
        const itemDate = new Date(m.timestamp.replace(" ", "T"));
        if (isNaN(itemDate.getTime())) return true;
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }

      if (range === "THIS_MONTH") {
        const currentMonth = todayStr.slice(0, 7); // YYYY-MM
        return itemDateStr.startsWith(currentMonth);
      }

      return true;
    });
  },

  /**
   * Compute comprehensive sales and profit metrics
   */
  getAnalyticsSummary(range: TimeRangeFilter = "ALL"): SalesAnalyticsSummary {
    const allProducts = MasterStore.getProducts();
    const allCategories = MasterStore.getCategories();
    const allMovements = MasterStore.getMovements();

    const categoryMap = new Map<string, CategoryItem>();
    allCategories.forEach((c) => categoryMap.set(c.id, c));

    const productMap = new Map<string, ProductItem>();
    allProducts.forEach((p) => productMap.set(p.id, p));

    // Filter movements by time range
    const filteredMovements = this.filterMovements(allMovements, range);

    // Sales transactions are ISSUE movements
    const issueMovements = filteredMovements.filter((m) => m.type === "ISSUE");

    // Aggregate units sold per product
    const productSoldMap = new Map<string, { units: number; txCount: number }>();
    const dailyMap = new Map<string, { revenue: number; profit: number; units: number }>();

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalUnitsSold = 0;

    issueMovements.forEach((m) => {
      const p = productMap.get(m.productId);
      const units = m.quantity || 0;
      totalUnitsSold += units;

      const costPrice = p ? p.costPrice : 0;
      const sellPrice = p ? p.sellPrice : costPrice * 1.25;

      const rev = units * sellPrice;
      const cogs = units * costPrice;
      const profit = rev - cogs;

      totalRevenue += rev;
      totalCogs += cogs;

      // Product sales tally
      const existing = productSoldMap.get(m.productId) || { units: 0, txCount: 0 };
      existing.units += units;
      existing.txCount += 1;
      productSoldMap.set(m.productId, existing);

      // Daily trend
      const dateKey = m.timestamp.slice(0, 10);
      const dayData = dailyMap.get(dateKey) || { revenue: 0, profit: 0, units: 0 };
      dayData.revenue += rev;
      dayData.profit += profit;
      dayData.units += units;
      dailyMap.set(dateKey, dayData);
    });

    const grossProfit = totalRevenue - totalCogs;
    const profitMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const totalIssueTransactions = issueMovements.length;
    const averageTransactionValue =
      totalIssueTransactions > 0 ? totalRevenue / totalIssueTransactions : 0;

    // Calculate inventory valuation
    let totalInventoryUnits = 0;
    let inventoryCostValue = 0;
    let inventoryRetailValue = 0;

    allProducts.forEach((p) => {
      const stock = p.stock || 0;
      totalInventoryUnits += stock;
      inventoryCostValue += stock * (p.costPrice || 0);
      inventoryRetailValue += stock * (p.sellPrice || 0);
    });

    const inventoryPotentialProfit = inventoryRetailValue - inventoryCostValue;

    // Build ProductSalesStat list for all products
    const productStats: ProductSalesStat[] = allProducts.map((p) => {
      const soldData = productSoldMap.get(p.id) || { units: 0, txCount: 0 };
      const unitsSold = soldData.units;
      const costPrice = p.costPrice || 0;
      const sellPrice = p.sellPrice || 0;
      const unitProfit = Math.max(0, sellPrice - costPrice);
      const marginPct = sellPrice > 0 ? (unitProfit / sellPrice) * 100 : 0;
      const rev = unitsSold * sellPrice;
      const cost = unitsSold * costPrice;
      const profit = rev - cost;

      const cat = categoryMap.get(p.categoryId);
      const categoryName = cat ? cat.name : "ทั่วไป";

      let status: ProductSalesStat["status"] = "NORMAL";
      if (unitsSold >= 15) {
        status = "FAST_MOVING";
      } else if (unitsSold === 0 && p.stock > 0) {
        status = "DEAD_STOCK";
      } else if (unitsSold > 0 && unitsSold <= 2 && p.stock > 10) {
        status = "SLOW_MOVING";
      }

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryName,
        unitsSold,
        costPrice,
        sellPrice,
        unitProfit,
        marginPct,
        totalRevenue: rev,
        totalCost: cost,
        totalProfit: profit,
        currentStock: p.stock,
        status,
      };
    });

    // Top Selling products (sorted by units sold desc, then revenue desc)
    const topSellingProducts = [...productStats]
      .filter((p) => p.unitsSold > 0)
      .sort((a, b) => b.unitsSold - a.unitsSold || b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Highest Profit products
    const highestProfitProducts = [...productStats]
      .filter((p) => p.totalProfit > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10);

    // Dead stock / Slow moving products (has stock but 0 sales)
    const deadStockProducts = productStats
      .filter((p) => p.status === "DEAD_STOCK" || p.status === "SLOW_MOVING")
      .sort((a, b) => b.currentStock * b.costPrice - a.currentStock * a.costPrice)
      .slice(0, 10);

    // Category breakdown
    const categoryStatsMap = new Map<
      string,
      {
        unitsSold: number;
        revenue: number;
        profit: number;
        stockUnits: number;
        stockCost: number;
      }
    >();

    allCategories.forEach((c) => {
      categoryStatsMap.set(c.id, {
        unitsSold: 0,
        revenue: 0,
        profit: 0,
        stockUnits: 0,
        stockCost: 0,
      });
    });

    productStats.forEach((p) => {
      const orig = productMap.get(p.productId);
      const catId = orig?.categoryId || "cat-general";
      const current = categoryStatsMap.get(catId) || {
        unitsSold: 0,
        revenue: 0,
        profit: 0,
        stockUnits: 0,
        stockCost: 0,
      };

      current.unitsSold += p.unitsSold;
      current.revenue += p.totalRevenue;
      current.profit += p.totalProfit;
      current.stockUnits += p.currentStock;
      current.stockCost += p.currentStock * p.costPrice;

      categoryStatsMap.set(catId, current);
    });

    const categoryBreakdown: CategorySalesStat[] = allCategories
      .map((c) => {
        const data = categoryStatsMap.get(c.id) || {
          unitsSold: 0,
          revenue: 0,
          profit: 0,
          stockUnits: 0,
          stockCost: 0,
        };
        const revenueSharePct = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;

        return {
          categoryId: c.id,
          categoryName: c.name,
          categoryCode: c.code,
          unitsSold: data.unitsSold,
          totalRevenue: data.revenue,
          totalProfit: data.profit,
          revenueSharePct,
          currentStockUnits: data.stockUnits,
          currentStockCostValue: data.stockCost,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Daily trends array
    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      timeRange: range,
      startDate: "2026-09-01",
      endDate: "2026-09-25",
      totalRevenue,
      totalCogs,
      grossProfit,
      profitMarginPct,
      totalUnitsSold,
      totalIssueTransactions,
      averageTransactionValue,
      totalInventoryUnits,
      inventoryCostValue,
      inventoryRetailValue,
      inventoryPotentialProfit,
      topSellingProducts,
      highestProfitProducts,
      deadStockProducts,
      categoryBreakdown,
      dailyTrends,
    };
  },

  /**
   * Export Sales & Margin Report to CSV format
   */
  exportToCsv(summary: SalesAnalyticsSummary): void {
    const rows: string[] = [];

    // Header
    rows.push(`"รายงานวิเคราะห์ยอดขายและอัตรากำไร - โชห่วยยุค90s"`);
    rows.push(`"ช่วงเวลา:", "${summary.timeRange}"`);
    rows.push(`"ยอดขายรวม (บาท):", "${summary.totalRevenue.toFixed(2)}"`);
    rows.push(`"ต้นทุนรวม (บาท):", "${summary.totalCogs.toFixed(2)}"`);
    rows.push(`"กำไรขั้นต้น (บาท):", "${summary.grossProfit.toFixed(2)}"`);
    rows.push(`"อัตรากำไร (%):", "${summary.profitMarginPct.toFixed(1)}%"`);
    rows.push(`"จำนวนชิ้นที่ขาย:", "${summary.totalUnitsSold}"`);
    rows.push(`""`);

    // Top Selling Products Table
    rows.push(`"สินค้าขายดี Top Selling SKUs"`);
    rows.push(
      `"ลำดับ","รหัสสินค้า SKU","บาร์โค้ด","ชื่อสินค้า","หมวดหมู่","จำนวนที่ขายได้","ราคาขาย","ราคาทุน","ยอดขายรวม (บาท)","กำไร (บาท)","Margin %","สต็อกคงเหลือ"`,
    );

    summary.topSellingProducts.forEach((p, idx) => {
      rows.push(
        `"${idx + 1}","${p.sku}","${p.barcode}","${p.productName.replace(/"/g, '""')}","${p.categoryName}","${p.unitsSold}","${p.sellPrice}","${p.costPrice}","${p.totalRevenue.toFixed(2)}","${p.totalProfit.toFixed(2)}","${p.marginPct.toFixed(1)}%","${p.currentStock}"`,
      );
    });

    rows.push(`""`);
    // Category Breakdown
    rows.push(`"สรุปยอดขายแยกตามหมวดหมู่ (Category Breakdown)"`);
    rows.push(
      `"หมวดหมู่","รหัส","จำนวนที่ขาย","ยอดขายรวม (บาท)","สัดส่วนยอดขาย (%)","กำไร (บาท)","สต็อกคงเหลือ (ชิ้น)","มูลค่าสต็อกทุน (บาท)"`,
    );

    summary.categoryBreakdown.forEach((c) => {
      rows.push(
        `"${c.categoryName}","${c.categoryCode}","${c.unitsSold}","${c.totalRevenue.toFixed(2)}","${c.revenueSharePct.toFixed(1)}%","${c.totalProfit.toFixed(2)}","${c.currentStockUnits}","${c.currentStockCostValue.toFixed(2)}"`,
      );
    });

    const csvContent = "\uFEFF" + rows.join("\r\n"); // UTF-8 BOM for Excel in Thai
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minimark_sales_analytics_${summary.timeRange.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
