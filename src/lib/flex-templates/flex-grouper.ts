/**
 * Helper to sort and group items by Category and Zone for LINE Flex Message & Text summaries.
 */

import { MasterStore } from "../store";

export type FlexItemGroupBy =
  | "zone_then_category"
  | "category_then_zone"
  | "zone"
  | "zone_no_header"
  | "category"
  | "category_no_header"
  | "none";

export interface ItemWithCategoryAndZone {
  name: string;
  barcode?: string | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  zoneId?: string | undefined;
  zoneName?: string | undefined;
}

export interface GroupedFlexItems<T extends ItemWithCategoryAndZone> {
  groupKey: string;
  headerTitle: string;
  zoneName: string;
  categoryName: string;
  items: { item: T; originalIndex: number }[];
}

export interface GroupFlexItemsOptions {
  groupBy?: FlexItemGroupBy;
  includeZone?: boolean;
}

/**
 * Resolves category name and zone name for an item using item properties or MasterStore lookup
 */
export function resolveItemMetadata<T extends ItemWithCategoryAndZone>(
  item: T,
): { categoryName: string; zoneName: string } {
  let catName = item.categoryName?.trim();
  let zName = item.zoneName?.trim();

  // If missing, look up from MasterStore by categoryId / zoneId
  if (!catName && item.categoryId) {
    catName = MasterStore.getCategoryName(item.categoryId);
  } else if (catName) {
    const lookedUp = MasterStore.getCategoryName(catName);
    if (lookedUp && lookedUp !== "ทั่วไป" && lookedUp !== catName) {
      catName = lookedUp;
    }
  }

  if (!zName && item.zoneId) {
    zName = MasterStore.getZoneName(item.zoneId);
  }

  // If still missing, check products list in MasterStore
  if (!catName || !zName || zName === "-") {
    try {
      const products = MasterStore.getProducts();
      const matched = products.find(
        (p) =>
          (item.barcode && p.barcode && item.barcode.trim() === p.barcode.trim()) ||
          (p.name && item.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()),
      );
      if (matched) {
        if (!catName) catName = MasterStore.getCategoryName(matched.categoryId);
        if (!zName || zName === "-") zName = MasterStore.getZoneName(matched.zoneId);
      }
    } catch {
      // ignore
    }
  }

  return {
    categoryName: catName && catName !== "-" ? catName : "หมวดหมู่ทั่วไป",
    zoneName: zName && zName !== "-" ? zName : "โซนทั่วไป",
  };
}

/**
 * Groups and sorts items so products belonging to the same category or zone are adjacent.
 * ค่าเริ่มต้น: จัดกลุ่มตามหมวดหมู่ (category) และไม่แสดงโซนใน Flex Message
 */
export function groupAndSortFlexItems<T extends ItemWithCategoryAndZone>(
  items: T[],
  groupByOrOptions: FlexItemGroupBy | GroupFlexItemsOptions = "category",
): GroupedFlexItems<T>[] {
  if (!items || items.length === 0) return [];

  const rawGroupBy: FlexItemGroupBy =
    typeof groupByOrOptions === "string"
      ? groupByOrOptions
      : groupByOrOptions?.groupBy || "category";

  const includeZone: boolean =
    typeof groupByOrOptions === "object" && typeof groupByOrOptions.includeZone === "boolean"
      ? groupByOrOptions.includeZone
      : rawGroupBy === "zone" ||
        rawGroupBy === "zone_then_category" ||
        rawGroupBy === "category_then_zone";

  const groupBy: FlexItemGroupBy = rawGroupBy;

  if (groupBy === "none") {
    return [
      {
        groupKey: "all",
        headerTitle: "",
        zoneName: "",
        categoryName: "",
        items: items.map((item, originalIndex) => ({ item, originalIndex })),
      },
    ];
  }

  // Enrich with resolved names
  const enriched = items.map((item, originalIndex) => {
    const meta = resolveItemMetadata(item);
    return {
      item,
      originalIndex,
      categoryName: meta.categoryName,
      zoneName: meta.zoneName,
    };
  });

  // Sort based on groupBy strategy
  enriched.sort((a, b) => {
    if (groupBy === "zone_then_category") {
      const zCompare = a.zoneName.localeCompare(b.zoneName, "th");
      if (zCompare !== 0) return zCompare;
      const cCompare = a.categoryName.localeCompare(b.categoryName, "th");
      if (cCompare !== 0) return cCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    if (groupBy === "category_then_zone") {
      const cCompare = a.categoryName.localeCompare(b.categoryName, "th");
      if (cCompare !== 0) return cCompare;
      const zCompare = a.zoneName.localeCompare(b.zoneName, "th");
      if (zCompare !== 0) return zCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    if (groupBy === "zone" || groupBy === "zone_no_header") {
      const zCompare = a.zoneName.localeCompare(b.zoneName, "th");
      if (zCompare !== 0) return zCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    if (groupBy === "category" || groupBy === "category_no_header") {
      const cCompare = a.categoryName.localeCompare(b.categoryName, "th");
      if (cCompare !== 0) return cCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    return 0;
  });

  // Group items
  const groupMap = new Map<string, GroupedFlexItems<T>>();

  enriched.forEach(({ item, originalIndex, categoryName, zoneName }) => {
    let groupKey = "";
    let headerTitle = "";

    switch (groupBy) {
      case "zone_then_category":
        groupKey = `${zoneName}:::${categoryName}`;
        headerTitle = `📍 ${zoneName} • 🏷️ ${categoryName}`;
        break;
      case "category_then_zone":
        groupKey = `${categoryName}:::${zoneName}`;
        headerTitle = `🏷️ ${categoryName} • 📍 ${zoneName}`;
        break;
      case "zone":
        groupKey = zoneName;
        headerTitle = `📍 โซน: ${zoneName}`;
        break;
      case "zone_no_header":
        groupKey = zoneName;
        headerTitle = "";
        break;
      case "category":
        groupKey = categoryName;
        headerTitle = `🏷️ ${categoryName}`;
        break;
      case "category_no_header":
        groupKey = categoryName;
        headerTitle = "";
        break;
    }

    let existing = groupMap.get(groupKey);
    if (!existing) {
      existing = {
        groupKey,
        headerTitle,
        zoneName,
        categoryName,
        items: [],
      };
      groupMap.set(groupKey, existing);
    }
    existing.items.push({ item, originalIndex });
  });

  return Array.from(groupMap.values());
}
