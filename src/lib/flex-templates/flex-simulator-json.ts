import type { FlexItemGroupBy } from "./flex-grouper";

export const FLEX_SIMULATOR_JSON_STORAGE_KEY = "minimark_custom_po_flex_json";

const DEFAULT_FLEX_ALT_TEXT = "📦 ใบสั่งซื้อสินค้าจากร้าน";

type JsonRecord = Record<string, unknown>;

export interface PurchaseOrderFlexTemplateItem {
  productName: string;
  quantity: number;
  unitName: string;
  barcode?: string | undefined;
  categoryName?: string | undefined;
  zoneName?: string | undefined;
  costPrice?: number | undefined;
  total?: number | undefined;
  note?: string | undefined;
}

export interface PurchaseOrderFlexTemplateData {
  orderNumber: string;
  orderDate: string;
  storeName: string;
  supplierName: string;
  items: readonly PurchaseOrderFlexTemplateItem[];
  totalQuantity: number;
  totalCost: number;
  note?: string | undefined;
  groupBy?: FlexItemGroupBy | undefined;
  showGroupHeaders?: boolean | undefined;
}

export type FlexSimulatorMessage = JsonRecord & {
  type: "flex";
  altText: string;
  contents: JsonRecord;
};

interface GroupContext {
  headerTitle: string;
  categoryName: string;
  zoneName?: string | undefined;
  itemCount: number;
  items: readonly PurchaseOrderFlexTemplateItem[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBubble(value: unknown): value is JsonRecord {
  return isRecord(value) && value["type"] === "bubble";
}

function isFlexContents(value: unknown): value is JsonRecord {
  if (isBubble(value)) return true;
  return (
    isRecord(value) &&
    value["type"] === "carousel" &&
    Array.isArray(value["contents"]) &&
    value["contents"].length > 0 &&
    value["contents"].every(isBubble)
  );
}

/**
 * Parse a bubble, carousel, or complete LINE Flex message copied from the LINE Flex Simulator.
 * The simulator's structure and styling are preserved.
 */
export function parseFlexSimulatorJson(rawJson: string): FlexSimulatorMessage {
  if (!rawJson.trim()) {
    throw new Error("กรุณาวาง JSON จาก LINE Flex Message Simulator ในกล่องก่อน");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`รูปแบบ JSON ไม่ถูกต้อง: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error("JSON ต้องเป็น bubble, carousel หรือข้อความ type: flex จาก LINE Simulator");
  }

  if (parsed["type"] === "bubble" || parsed["type"] === "carousel") {
    if (!isFlexContents(parsed)) {
      throw new Error("โครงสร้าง bubble/carousel จาก LINE Simulator ไม่ถูกต้อง");
    }
    return {
      type: "flex",
      altText: DEFAULT_FLEX_ALT_TEXT,
      contents: parsed,
    };
  }

  if (parsed["type"] === "flex") {
    if (!isFlexContents(parsed["contents"])) {
      throw new Error("ข้อความ type: flex ต้องมี contents เป็น bubble หรือ carousel ที่ถูกต้อง");
    }
    const altText =
      typeof parsed["altText"] === "string" && parsed["altText"].trim()
        ? parsed["altText"]
        : DEFAULT_FLEX_ALT_TEXT;
    return { ...parsed, type: "flex", altText, contents: parsed["contents"] };
  }

  throw new Error("รองรับเฉพาะ JSON bubble, carousel หรือ type: flex จาก LINE Flex Simulator");
}

/** Read the latest JSON textbox value; this is the layout source, not the purchase-order data source. */
export function getLatestPurchaseOrderFlexMessage(
  storage?: Pick<Storage, "getItem">,
): FlexSimulatorMessage {
  const currentStorage =
    storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!currentStorage) {
    throw new Error("ไม่สามารถอ่าน JSON จากกล่อง LINE Simulator ในสภาพแวดล้อมนี้ได้");
  }

  const rawJson = currentStorage.getItem(FLEX_SIMULATOR_JSON_STORAGE_KEY);
  if (!rawJson?.trim()) {
    throw new Error("ยังไม่มี JSON ในกล่อง LINE Simulator กรุณาวาง JSON แล้วลองอีกครั้ง");
  }

  return parseFlexSimulatorJson(rawJson);
}

function hasItemPlaceholder(value: unknown): boolean {
  if (typeof value === "string") {
    return /\{\{\s*(?:item\.)?(?:productName|name|quantity|unitName|unit|barcode|categoryName|zoneName|costPrice|lineTotal|index|itemNote)\s*\}\}/i.test(
      value,
    );
  }
  if (Array.isArray(value)) return value.some(hasItemPlaceholder);
  if (isRecord(value)) return Object.values(value).some(hasItemPlaceholder);
  return false;
}
function hasRepeatingItemField(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /\{\{\s*(?:item\.)?(?:productName|name|quantity|unitName|unit|barcode|costPrice|lineTotal|index|itemNote)\s*\}\}/i.test(
      value,
    )
  );
}

function directTextNodes(row: JsonRecord): JsonRecord[] {
  const contents = row["contents"];
  if (!Array.isArray(contents)) return [];
  return contents.filter(
    (child): child is JsonRecord =>
      isRecord(child) && child["type"] === "text" && typeof child["text"] === "string",
  );
}

function isExplicitItemRow(value: unknown): value is JsonRecord {
  if (!isRecord(value) || value["type"] !== "box") return false;
  const textNodes = directTextNodes(value);
  return textNodes.length > 0 && textNodes.some((node) => hasRepeatingItemField(node["text"]));
}

/** Recognize the app's standard horizontal sample rows when users haven't added tokens. */
function isSampleItemRow(value: unknown): value is JsonRecord {
  if (!isRecord(value) || value["type"] !== "box" || value["layout"] !== "horizontal") {
    return false;
  }
  if (typeof value["backgroundColor"] === "string" || hasItemPlaceholder(value)) return false;
  const textNodes = directTextNodes(value);
  if (textNodes.length < 2) return false;
  const first = textNodes[0]?.["text"];
  const second = textNodes[1]?.["text"];
  if (typeof first !== "string" || typeof second !== "string") return false;
  if (!/^\s*\d+(?:\.\d+)?\s*$/.test(second) && !/^\s*\d+(?:\.\d+)?\s+\S+\s*$/.test(second)) {
    return false;
  }
  if (/\b(?:รายการ|สินค้า)\b/.test(second)) return false;
  return (
    /^\s*\d+[.)]\s*/.test(first) ||
    value["margin"] === "sm" ||
    value["spacing"] === "sm" ||
    textNodes.length >= 3
  );
}

function isSampleGroupHeader(value: unknown): value is JsonRecord {
  if (!isRecord(value) || value["type"] !== "box") {
    return false;
  }
  if (typeof value["backgroundColor"] !== "string" && value["paddingAll"] === undefined) {
    return false;
  }
  const textNodes = directTextNodes(value);
  if (textNodes.length === 0) return false;
  const countText = textNodes[1]?.["text"];
  if (
    textNodes.length >= 2 &&
    typeof countText === "string" &&
    /^\s*\d+\s*รายการ\s*$/.test(countText)
  ) {
    return true;
  }
  const firstText = textNodes[0]?.["text"];
  if (
    typeof firstText === "string" &&
    /^\s*(?:🏷️|📍|หมวดหมู่|โซน)\s*/.test(firstText) &&
    !hasItemPlaceholder(value)
  ) {
    return true;
  }
  return false;
}
function isExplicitGroupHeader(value: unknown): value is JsonRecord {
  if (!isRecord(value) || value["type"] !== "box" || value["layout"] !== "horizontal") {
    return false;
  }
  const textNodes = directTextNodes(value);
  return (
    textNodes.length >= 2 &&
    !isExplicitItemRow(value) &&
    textNodes.some(
      (node) =>
        typeof node["text"] === "string" &&
        /\{\{\s*(?:categoryName|category|groupName|group|groupCount|itemCount)\s*\}\}/i.test(
          node["text"],
        ),
    )
  );
}

function formatMoney(value: number): string {
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
}

function getItemValue(
  key: string,
  data: PurchaseOrderFlexTemplateData,
  item?: PurchaseOrderFlexTemplateItem,
  index?: number,
  group?: GroupContext,
): string | undefined {
  const normalized = key
    .trim()
    .replace(/^item\./i, "")
    .toLowerCase();
  switch (normalized) {
    case "storename":
    case "store":
      return data.storeName;
    case "suppliername":
    case "supplier":
      return data.supplierName;
    case "ordernumber":
    case "ponumber":
      return data.orderNumber;
    case "date":
    case "orderdate":
    case "createdat":
      return data.orderDate;
    case "totalquantity":
    case "totalunits":
      return String(data.totalQuantity);
    case "itemcount":
    case "itemcounts":
    case "items.length":
      return String(group?.itemCount ?? data.items.length);
    case "totalcost":
    case "grandtotal":
      return formatMoney(data.totalCost);
    case "note":
    case "itemnote":
      return item?.note ?? data.note ?? "";
    case "productname":
    case "name":
      return item?.productName;
    case "quantity":
      return item ? String(item.quantity) : undefined;
    case "unitname":
    case "unit":
      return item?.unitName;
    case "barcode":
      return item?.barcode;
    case "categoryname":
    case "category":
      return item?.categoryName ?? group?.categoryName;
    case "zonename":
    case "zone":
      return item?.zoneName;
    case "costprice":
      return item ? formatMoney(item.costPrice ?? 0) : undefined;
    case "linetotal":
    case "total":
    case "amount":
      return item
        ? formatMoney(item.total ?? item.quantity * (item.costPrice ?? 0))
        : formatMoney(data.totalCost);
    case "index":
    case "number":
      return index === undefined ? undefined : String(index + 1);
    case "groupname":
    case "group":
    case "headertitle":
      return group?.headerTitle ?? group?.categoryName;
    case "groupcount":
      return group ? String(group.itemCount) : undefined;
    case "items":
      return data.items
        .map(
          (orderItem, itemIndex) =>
            `${itemIndex + 1}. ${orderItem.productName} — ${orderItem.quantity} ${orderItem.unitName}`,
        )
        .join("\n");
    default:
      return undefined;
  }
}

function interpolateText(
  text: string,
  data: PurchaseOrderFlexTemplateData,
  item?: PurchaseOrderFlexTemplateItem,
  index?: number,
  group?: GroupContext,
): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (placeholder, key: string) => {
    const value = getItemValue(key, data, item, index, group);
    return value === undefined ? placeholder : value;
  });
}

function replaceKnownStaticValue(text: string, data: PurchaseOrderFlexTemplateData): string {
  if (/^\s*🏪\s*/.test(text)) {
    return `🏪 ${data.storeName}`;
  }
  if (/^\s*📅\s*(?:วันที่\s*[:：])?/.test(text)) {
    const prefix = text.match(/^\s*📅\s*(?:วันที่\s*[:：])?/)?.[0] ?? "📅 วันที่: ";
    return `${prefix}${data.orderDate}`;
  }
  if (/^\s*\d+\s*รายการ\s*\([^)]*\)\s*$/.test(text)) {
    return `${data.items.length} รายการ (${data.totalQuantity} หน่วย)`;
  }
  return text;
}

function renderTextComponent(
  value: JsonRecord,
  data: PurchaseOrderFlexTemplateData,
  item?: PurchaseOrderFlexTemplateItem,
  index?: number,
  group?: GroupContext,
): JsonRecord {
  const rawText = value["text"];
  if (typeof rawText !== "string") return value;
  const interpolated = interpolateText(rawText, data, item, index, group);
  return {
    ...value,
    text:
      interpolated === rawText && !item && !group && !rawText.includes("{{")
        ? replaceKnownStaticValue(rawText, data)
        : interpolated,
  };
}

function renderItemRow(
  row: JsonRecord,
  data: PurchaseOrderFlexTemplateData,
  item: PurchaseOrderFlexTemplateItem,
  index: number,
  inferSampleCells: boolean,
): JsonRecord {
  const contents = row["contents"];
  if (!Array.isArray(contents)) return row;
  let cellIndex = 0;
  const renderedContents = contents.map((child) => {
    if (!isRecord(child) || child["type"] !== "text" || typeof child["text"] !== "string") {
      return renderNode(child, data, item, index);
    }
    const rawText = child["text"];
    const hasPlaceholder = hasItemPlaceholder(rawText);
    if (hasPlaceholder) return renderTextComponent(child, data, item, index);
    if (!inferSampleCells) return renderNode(child, data, item, index);

    const currentCell = cellIndex;
    cellIndex += 1;
    let replacement = rawText;
    if (currentCell === 0) {
      const numberingMatch = rawText.match(/^(\s*)\d+([.)]\s*)/);
      const numbering = numberingMatch
        ? `${numberingMatch[1]}${index + 1}${numberingMatch[2]}`
        : "";
      replacement = `${numbering}${item.productName}`;
    } else if (currentCell === 1) {
      const prefix = rawText.match(/^(\s*(?:จำนวน\s*[:：]?\s*)?)/)?.[0] ?? "";
      replacement =
        contents.filter(
          (entry) =>
            isRecord(entry) && entry["type"] === "text" && typeof entry["text"] === "string",
        ).length >= 3
          ? `${prefix}${item.quantity}`
          : `${prefix}${item.quantity} ${item.unitName}`;
    } else if (currentCell === 2) {
      replacement = item.unitName;
    }
    return { ...child, text: replacement };
  });
  return { ...row, contents: renderedContents };
}

function renderGroupHeader(
  row: JsonRecord,
  data: PurchaseOrderFlexTemplateData,
  group: GroupContext,
): JsonRecord {
  const contents = row["contents"];
  if (!Array.isArray(contents)) return row;
  let textIndex = 0;
  const renderedContents = contents.map((child) => {
    if (!isRecord(child) || child["type"] !== "text" || typeof child["text"] !== "string") {
      return renderNode(child, data, undefined, undefined, group);
    }
    const rawText = child["text"];
    const currentIndex = textIndex;
    textIndex += 1;
    if (currentIndex === 0) {
      if (group.headerTitle) {
        return { ...child, text: group.headerTitle };
      }
      return { ...child, text: group.categoryName || "" };
    }
    if (rawText.includes("{{"))
      return renderTextComponent(child, data, undefined, undefined, group);
    if (currentIndex === 1 && /^\s*\d+\s*รายการ\s*$/.test(rawText)) {
      return { ...child, text: `${group.itemCount} รายการ` };
    }
    return renderNode(child, data, undefined, undefined, group);
  });
  return { ...row, contents: renderedContents };
}

function groupOrderItems(
  items: readonly PurchaseOrderFlexTemplateItem[],
  groupBy: FlexItemGroupBy = "category",
): GroupContext[] {
  if (groupBy === "none") {
    return [
      {
        headerTitle: "",
        categoryName: "",
        itemCount: items.length,
        items,
      },
    ];
  }

  const groups = new Map<
    string,
    {
      headerTitle: string;
      categoryName: string;
      zoneName: string;
      items: PurchaseOrderFlexTemplateItem[];
    }
  >();

  items.forEach((item) => {
    const catName = item.categoryName?.trim() || "หมวดหมู่ทั่วไป";
    const zoneName = item.zoneName?.trim() || "โซนทั่วไป";

    let groupKey = catName;
    let headerTitle = `🏷️ ${catName}`;

    if (groupBy === "zone_then_category") {
      groupKey = `${zoneName}:::${catName}`;
      headerTitle = `📍 ${zoneName} • 🏷️ ${catName}`;
    } else if (groupBy === "category_then_zone") {
      groupKey = `${catName}:::${zoneName}`;
      headerTitle = `🏷️ ${catName} • 📍 ${zoneName}`;
    } else if (groupBy === "zone") {
      groupKey = zoneName;
      headerTitle = `📍 โซน: ${zoneName}`;
    } else if (groupBy === "zone_no_header") {
      groupKey = zoneName;
      headerTitle = "";
    } else if (groupBy === "category") {
      groupKey = catName;
      headerTitle = `🏷️ ${catName}`;
    } else if (groupBy === "category_no_header") {
      groupKey = catName;
      headerTitle = "";
    }

    const existing = groups.get(groupKey) ?? {
      headerTitle,
      categoryName: catName,
      zoneName,
      items: [],
    };
    existing.items.push(item);
    groups.set(groupKey, existing);
  });

  return [...groups.values()].map((g) => ({
    headerTitle: g.headerTitle,
    categoryName: g.categoryName,
    zoneName: g.zoneName,
    itemCount: g.items.length,
    items: g.items,
  }));
}

function renderArray(
  values: unknown[],
  data: PurchaseOrderFlexTemplateData,
  item?: PurchaseOrderFlexTemplateItem,
  itemIndex?: number,
  group?: GroupContext,
): unknown[] {
  const rowIndices = values
    .map((value, index) => (isExplicitItemRow(value) || isSampleItemRow(value) ? index : -1))
    .filter((index) => index >= 0);
  if (rowIndices.length === 0) {
    return values.map((value) => renderNode(value, data, item, itemIndex, group));
  }

  const headerIndices = values
    .map((value, index) =>
      isSampleGroupHeader(value) || isExplicitGroupHeader(value) ? index : -1,
    )
    .filter((index) => index >= 0);
  const firstDynamicIndex = Math.min(...rowIndices, ...headerIndices);
  const rowTemplates = rowIndices.map((index) => values[index]).filter(isRecord);
  const headerTemplate = headerIndices.map((index) => values[index]).find(isRecord);
  const generatedRows: unknown[] = [];
  const groupBy = data.groupBy || "category";
  const isNoHeader =
    groupBy === "none" ||
    groupBy === "category_no_header" ||
    groupBy === "zone_no_header" ||
    data.showGroupHeaders === false;
  const shouldRenderHeader = Boolean(headerTemplate && !isNoHeader);
  const groups =
    groupBy !== "none"
      ? groupOrderItems(data.items, groupBy)
      : [{ headerTitle: "", categoryName: "", itemCount: data.items.length, items: data.items }];

  let globalItemIndex = 0;
  groups.forEach((currentGroup) => {
    if (shouldRenderHeader && headerTemplate && currentGroup.headerTitle) {
      generatedRows.push(renderGroupHeader(headerTemplate, data, currentGroup));
    }
    currentGroup.items.forEach((orderItem) => {
      const currentIndex = globalItemIndex++;
      const rowTemplate = rowTemplates[currentIndex % rowTemplates.length] ?? rowTemplates[0];
      if (rowTemplate) {
        generatedRows.push(
          renderItemRow(rowTemplate, data, orderItem, currentIndex, isSampleItemRow(rowTemplate)),
        );
      }
    });
  });

  const dynamicIndices = new Set([...rowIndices, ...headerIndices]);
  const output: unknown[] = [];
  values.forEach((value, index) => {
    if (index === firstDynamicIndex) output.push(...generatedRows);
    if (!dynamicIndices.has(index)) output.push(renderNode(value, data, item, itemIndex, group));
  });
  return output;
}

function renderNode(
  value: unknown,
  data: PurchaseOrderFlexTemplateData,
  item?: PurchaseOrderFlexTemplateItem,
  index?: number,
  group?: GroupContext,
): unknown {
  if (Array.isArray(value)) return renderArray(value, data, item, index, group);
  if (!isRecord(value)) return value;
  if (value["type"] === "text") return renderTextComponent(value, data, item, index, group);

  const contents = value["contents"];
  if (value["type"] === "box" && value["layout"] === "horizontal" && Array.isArray(contents)) {
    const textNodes = directTextNodes(value);
    const label = textNodes[0]?.["text"];
    const valueNode = textNodes[1];
    if (typeof label === "string" && valueNode && typeof valueNode["text"] === "string") {
      const labelText = label.toLowerCase();
      const valueText = valueNode["text"];
      let replacement: string | undefined;
      if (/รวมจำนวนสินค้า|จำนวนสินค้าทั้งหมด|total quantity/i.test(labelText)) {
        replacement = `${data.items.length} รายการ (${data.totalQuantity} หน่วย)`;
      } else if (/ยอดเงิน|ยอดรวม|ประมาณ.*ยอด|grand total|total amount/i.test(labelText)) {
        replacement = formatMoney(data.totalCost);
      }
      if (replacement !== undefined && !valueText.includes("{{")) {
        let textIndex = 0;
        const nextContents = contents.map((child) => {
          if (!isRecord(child) || child["type"] !== "text")
            return renderNode(child, data, item, index, group);
          const currentIndex = textIndex;
          textIndex += 1;
          return currentIndex === 1
            ? { ...renderTextComponent(child, data, item, index, group), text: replacement }
            : renderTextComponent(child, data, item, index, group);
        });
        const rendered: JsonRecord = { ...value, contents: nextContents };
        return rendered;
      }
    }
  }

  const rendered: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    rendered[key] =
      key === "contents" && Array.isArray(child)
        ? renderArray(child, data, item, index, group)
        : renderNode(child, data, item, index, group);
  }
  return rendered;
}

/** Apply real order data to the latest Simulator layout while preserving its component styling. */
export function populatePurchaseOrderFlexTemplate(
  template: FlexSimulatorMessage,
  data: PurchaseOrderFlexTemplateData,
): FlexSimulatorMessage {
  const contents = renderNode(template.contents, data);
  const altText = interpolateText(template.altText, data);
  const updatedAltText = altText
    .replace(/\d+\s*รายการ/g, `${data.items.length} รายการ`)
    .replace(/รวม\s*\d+\s*(?:หน่วย|ชิ้น)/g, `รวม ${data.totalQuantity} หน่วย`);
  return {
    ...template,
    altText: updatedAltText,
    contents: isRecord(contents) ? contents : template.contents,
  };
}
