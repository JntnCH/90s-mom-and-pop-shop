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
  subCategoryId?: string | undefined;
  subCategoryName?: string | undefined;
  zoneId?: string | undefined;
  zoneName?: string | undefined;
}

export interface GroupedFlexItems<T extends ItemWithCategoryAndZone> {
  groupKey: string;
  headerTitle: string;
  zoneName: string;
  categoryName: string;
  subCategoryName?: string | undefined;
  items: { item: T; originalIndex: number }[];
}

export interface GroupFlexItemsOptions {
  groupBy?: FlexItemGroupBy;
  includeZone?: boolean;
}

/**
 * Resolves category name, subcategory name, and zone name for an item using item properties or MasterStore lookup
 */
export function resolveItemMetadata<T extends ItemWithCategoryAndZone>(
  item: T,
): { categoryName: string; subCategoryName: string; zoneName: string } {
  const isInvalidName = (val?: string) =>
    !val ||
    val === "-" ||
    val === "ไม่ระบุ" ||
    val === "หมวดหมู่ทั่วไป" ||
    val === "หมวดหมู่ย่อยทั่วไป" ||
    val === "โซนทั่วไป";

  let catName = item.categoryName?.trim();
  let subCatName = item.subCategoryName?.trim();
  let zName = item.zoneName?.trim();

  // 1. Prefer resolving from explicit categoryId / subCategoryId if provided and valid in MasterStore
  if (item.categoryId) {
    const byId = MasterStore.getCategoryName(item.categoryId);
    if (!isInvalidName(byId)) {
      catName = byId;
    }
  }

  // 2. If catName is actually a categoryId (e.g. "cat-1"), resolve it without overwriting valid names with "ไม่ระบุ"
  if (catName && !isInvalidName(catName)) {
    const lookedUp = MasterStore.getCategoryName(catName);
    if (!isInvalidName(lookedUp) && lookedUp !== "ทั่วไป") {
      catName = lookedUp;
    }
  }

  if (item.subCategoryId) {
    const subById = MasterStore.getSubCategoryName(item.subCategoryId);
    if (!isInvalidName(subById)) {
      subCatName = subById;
    }
  }

  if (subCatName && !isInvalidName(subCatName)) {
    const lookedUpSub = MasterStore.getSubCategoryName(subCatName);
    if (!isInvalidName(lookedUpSub)) {
      subCatName = lookedUpSub;
    }
  }

  if (item.zoneId) {
    const zById = MasterStore.getZoneName(item.zoneId);
    if (!isInvalidName(zById)) {
      zName = zById;
    }
  }

  // 3. If category, subcategory, or zone is still missing/invalid, look up the product in MasterStore
  if (isInvalidName(catName) || isInvalidName(subCatName) || isInvalidName(zName)) {
    try {
      const products = MasterStore.getProducts();
      const itemWithId = item as T & {
        productId?: string;
        product?: { id?: string; categoryId?: string; subCategoryId?: string; zoneId?: string };
      };
      const prodId = itemWithId.productId || itemWithId.product?.id;
      const matched = products.find(
        (p) =>
          (prodId && p.id === prodId) ||
          (item.barcode && p.barcode && item.barcode.trim() === item.barcode.trim()) ||
          (p.name && item.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()),
      );
      if (matched) {
        if (isInvalidName(catName) && matched.categoryId) {
          const matchedCat = MasterStore.getCategoryName(matched.categoryId);
          if (!isInvalidName(matchedCat)) catName = matchedCat;
        }
        if (isInvalidName(subCatName) && matched.subCategoryId) {
          const matchedSub = MasterStore.getSubCategoryName(matched.subCategoryId);
          if (!isInvalidName(matchedSub)) subCatName = matchedSub;
        }
        if (isInvalidName(zName) && matched.zoneId) {
          const matchedZone = MasterStore.getZoneName(matched.zoneId);
          if (!isInvalidName(matchedZone)) zName = matchedZone;
        }
      }
      // Also check nested item.product if present (e.g. FullOrderItem)
      if (itemWithId.product) {
        if (isInvalidName(catName) && itemWithId.product.categoryId) {
          const nestedCat = MasterStore.getCategoryName(itemWithId.product.categoryId);
          if (!isInvalidName(nestedCat)) catName = nestedCat;
        }
        if (isInvalidName(subCatName) && itemWithId.product.subCategoryId) {
          const nestedSub = MasterStore.getSubCategoryName(itemWithId.product.subCategoryId);
          if (!isInvalidName(nestedSub)) subCatName = nestedSub;
        }
        if (isInvalidName(zName) && itemWithId.product.zoneId) {
          const nestedZone = MasterStore.getZoneName(itemWithId.product.zoneId);
          if (!isInvalidName(nestedZone)) zName = nestedZone;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    categoryName: !isInvalidName(catName) ? catName! : "หมวดหมู่ทั่วไป",
    subCategoryName: !isInvalidName(subCatName) ? subCatName! : "",
    zoneName: !isInvalidName(zName) ? zName! : "โซนทั่วไป",
  };
}

function compareCategoryNames(aCat: string, bCat: string): number {
  const aIsFallback = !aCat || aCat === "หมวดหมู่ทั่วไป" || aCat === "ไม่ระบุ";
  const bIsFallback = !bCat || bCat === "หมวดหมู่ทั่วไป" || bCat === "ไม่ระบุ";
  if (aIsFallback !== bIsFallback) {
    return aIsFallback ? 1 : -1;
  }
  return aCat.localeCompare(bCat, "th");
}

function compareSubCategoryNames(aSub: string, bSub: string): number {
  const aEmpty = !aSub || aSub === "-" || aSub === "ไม่ระบุ";
  const bEmpty = !bSub || bSub === "-" || bSub === "ไม่ระบุ";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
  return aSub.localeCompare(bSub, "th");
}

/**
 * Groups and sorts items so products belonging to the same Main Category and Subcategory are adjacent.
 * ค่าเริ่มต้น: จัดเรียงตาม หมวดหมู่หลัก -> หมวดหมู่ย่อย -> ชื่อสินค้า
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

  const groupBy: FlexItemGroupBy = rawGroupBy;

  if (groupBy === "none") {
    return [
      {
        groupKey: "all",
        headerTitle: "",
        zoneName: "",
        categoryName: "",
        subCategoryName: "",
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
      subCategoryName: meta.subCategoryName,
      zoneName: meta.zoneName,
    };
  });

  // Sort based on groupBy strategy (always sorting by Main Category -> Subcategory -> Product Name)
  enriched.sort((a, b) => {
    if (groupBy === "zone_then_category") {
      const zCompare = a.zoneName.localeCompare(b.zoneName, "th");
      if (zCompare !== 0) return zCompare;
      const cCompare = compareCategoryNames(a.categoryName, b.categoryName);
      if (cCompare !== 0) return cCompare;
      const sCompare = compareSubCategoryNames(a.subCategoryName, b.subCategoryName);
      if (sCompare !== 0) return sCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    if (groupBy === "category_then_zone") {
      const cCompare = compareCategoryNames(a.categoryName, b.categoryName);
      if (cCompare !== 0) return cCompare;
      const sCompare = compareSubCategoryNames(a.subCategoryName, b.subCategoryName);
      if (sCompare !== 0) return sCompare;
      const zCompare = a.zoneName.localeCompare(b.zoneName, "th");
      if (zCompare !== 0) return zCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    if (groupBy === "zone" || groupBy === "zone_no_header") {
      const zCompare = a.zoneName.localeCompare(b.zoneName, "th");
      if (zCompare !== 0) return zCompare;
      const cCompare = compareCategoryNames(a.categoryName, b.categoryName);
      if (cCompare !== 0) return cCompare;
      const sCompare = compareSubCategoryNames(a.subCategoryName, b.subCategoryName);
      if (sCompare !== 0) return sCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    if (groupBy === "category" || groupBy === "category_no_header") {
      const cCompare = compareCategoryNames(a.categoryName, b.categoryName);
      if (cCompare !== 0) return cCompare;
      const sCompare = compareSubCategoryNames(a.subCategoryName, b.subCategoryName);
      if (sCompare !== 0) return sCompare;
      return a.item.name.localeCompare(b.item.name, "th");
    }

    return 0;
  });

  // Group items
  const groupMap = new Map<string, GroupedFlexItems<T>>();

  enriched.forEach(({ item, originalIndex, categoryName, subCategoryName, zoneName }) => {
    let groupKey = "";
    let headerTitle = "";
    const catWithSubLabel = subCategoryName ? `${categoryName} › ${subCategoryName}` : categoryName;

    switch (groupBy) {
      case "zone_then_category":
        groupKey = `${zoneName}:::${categoryName}:::${subCategoryName}`;
        headerTitle = `📍 ${zoneName} • 🏷️ ${catWithSubLabel}`;
        break;
      case "category_then_zone":
        groupKey = `${categoryName}:::${subCategoryName}:::${zoneName}`;
        headerTitle = `🏷️ ${catWithSubLabel} • 📍 ${zoneName}`;
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
        groupKey = `${categoryName}:::${subCategoryName}`;
        headerTitle = `🏷️ ${catWithSubLabel}`;
        break;
      case "category_no_header":
        groupKey = `${categoryName}:::${subCategoryName}`;
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
        subCategoryName,
        items: [],
      };
      groupMap.set(groupKey, existing);
    }
    existing.items.push({ item, originalIndex });
  });

  return Array.from(groupMap.values());
}
