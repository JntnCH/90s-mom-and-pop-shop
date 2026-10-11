import { describe, expect, it } from "vitest";
import {
  createPurchaseOrderFlexBubble,
  createStockAlertFlexBubble,
  createDailySummaryFlexBubble,
} from "./index";

function requiredAt<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Expected an item at index ${index}`);
  return value;
}

function requiredValue<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected a value to be present");
  return value;
}

describe("Flex Message Template Customization (Separated Qty/Unit & Large Font)", () => {
  it("creates Purchase Order flex with separated quantity and unit columns by default", () => {
    const flex = createPurchaseOrderFlexBubble([
      {
        name: "ปลาร้า แม่เหรียญ",
        quantity: 5,
        unitName: "แพ็ค",
        costPrice: 180,
      },
    ]);

    expect(flex.type).toBe("flex");
    const contents = flex.contents;
    expect(contents.type).toBe("bubble");

    // Header has larger store title
    const headerContents = contents.header.contents;
    const storeText = requiredAt(headerContents, 0);
    expect(storeText.size).toBe("xl");

    // Body should contain table header with 3 separated columns
    const bodyContents = contents.body.contents;
    const tableHeader = bodyContents[0] as {
      type: string;
      layout: string;
      contents: Array<{ text: string; flex?: number; size?: string }>;
    };

    expect(tableHeader.type).toBe("box");
    expect(tableHeader.layout).toBe("horizontal");
    expect(tableHeader.contents.length).toBe(3);
    expect(requiredAt(tableHeader.contents, 0).text).toBe("รายการสินค้า");
    expect(requiredAt(tableHeader.contents, 1).text).toBe("จำนวน");
    expect(requiredAt(tableHeader.contents, 2).text).toBe("หน่วยนับ");
    expect(requiredAt(tableHeader.contents, 0).size).toBe("sm");

    // Item row should have 3 separated columns with larger fonts (after group header banner)
    const itemsBox = bodyContents[2] as {
      contents: Array<{
        type: string;
        layout: string;
        contents: Array<{ text: string; size?: string; flex?: number; color?: string }>;
      }>;
    };
    // If group header is enabled, item row is after group header
    const productRow = requiredValue(
      itemsBox.contents.find((c) => c.contents && c.contents.length === 3),
    );
    expect(productRow).toBeDefined();
    expect(requiredAt(productRow.contents, 0).text).toContain("ปลาร้า แม่เหรียญ");
    expect(requiredAt(productRow.contents, 0).size).toBe("md");
    expect(requiredAt(productRow.contents, 1).text).toBe("5");
    expect(requiredAt(productRow.contents, 1).size).toBe("lg");
    expect(requiredAt(productRow.contents, 2).text).toBe("แพ็ค");
    expect(requiredAt(productRow.contents, 2).size).toBe("md");
  });

  it("creates Stock Alert flex with separated stock and unit columns and large font", () => {
    const flex = createStockAlertFlexBubble([
      {
        name: "นมสดจืด",
        stock: 2,
        minStock: 10,
        unitName: "กล่อง",
        status: "LOW_STOCK",
      },
    ]);

    expect(flex.type).toBe("flex");
    const contents = flex.contents;
    expect(contents.type).toBe("bubble");

    // Body table header should have 3 columns
    const bodyContents = contents.body.contents;
    const tableHeader = bodyContents[0] as {
      contents: Array<{ text: string; size?: string }>;
    };
    expect(tableHeader.contents.length).toBe(3);
    expect(requiredAt(tableHeader.contents, 0).text).toBe("รายการสินค้า");
    expect(requiredAt(tableHeader.contents, 1).text).toBe("คงเหลือ");
    expect(requiredAt(tableHeader.contents, 2).text).toBe("หน่วยนับ");

    // Alert row has separated values (after group header banner)
    const itemsBox = bodyContents[2] as {
      contents: Array<{
        contents: Array<{ text: string; size?: string }>;
      }>;
    };
    const productRow = requiredValue(
      itemsBox.contents.find((c) => c.contents && c.contents.length === 3),
    );
    expect(productRow).toBeDefined();
    expect(requiredAt(productRow.contents, 0).text).toContain("นมสดจืด");
    expect(requiredAt(productRow.contents, 1).text).toBe("2");
    expect(requiredAt(productRow.contents, 1).size).toBe("lg");
    expect(requiredAt(productRow.contents, 2).text).toBe("กล่อง");
    expect(requiredAt(productRow.contents, 2).size).toBe("md");
  });

  it("always enforces 3 columns (รายการสินค้า, จำนวน, หน่วยนับ) without 2 columns", () => {
    const flex = createPurchaseOrderFlexBubble(
      [
        {
          name: "บะหมี่ไวไว",
          quantity: 10,
          unitName: "ซอง",
        },
      ],
      {
        separateQuantityUnit: false,
        fontSize: "medium",
      },
    );

    const bodyContents = flex.contents.body.contents;
    const tableHeader = bodyContents[0] as {
      contents: Array<{ text: string; size?: string }>;
    };
    expect(tableHeader.contents.length).toBe(3);
    expect(requiredAt(tableHeader.contents, 0).text).toBe("รายการสินค้า");
    expect(requiredAt(tableHeader.contents, 1).text).toBe("จำนวน");
    expect(requiredAt(tableHeader.contents, 2).text).toBe("หน่วยนับ");
    expect(requiredAt(tableHeader.contents, 0).size).toBe("xs");
  });

  it("does not include zone in the Flex Message headers by default", () => {
    const flex = createPurchaseOrderFlexBubble([
      {
        name: "ช้างขวด",
        quantity: 20,
        unitName: "ขวด",
        categoryName: "เครื่องดื่ม",
        zoneName: "ตู้แช่ เครื่องดื่ม",
      },
      {
        name: "40 ดีกรี กลาง",
        quantity: 20,
        unitName: "ลัง",
        categoryName: "เหล้า",
        zoneName: "หน้าร้าน/เคาน์เตอร์",
      },
    ]);

    const bodyContents = flex.contents.body.contents;
    const itemsBox = bodyContents[2] as {
      contents: Array<{
        type: string;
        layout?: string;
        contents: Array<{ text: string; size?: string }>;
      }>;
    };

    // Find group header banners (they have 2 items: title and count)
    const headerBanners = itemsBox.contents.filter(
      (c) => c.contents.length === 2 && requiredAt(c.contents, 0).text.startsWith("🏷️"),
    );

    expect(headerBanners.length).toBeGreaterThan(0);
    headerBanners.forEach((banner) => {
      const bannerText = requiredAt(banner.contents, 0).text;
      // Must NOT contain 📍 or zone names
      expect(bannerText).not.toContain("📍");
      expect(bannerText).not.toContain("ตู้แช่");
      expect(bannerText).not.toContain("หน้าร้าน");
      // Must contain category tag
      expect(bannerText.startsWith("🏷️")).toBe(true);
    });
  });

  it("creates Daily Summary flex with large typography", () => {
    const flex = createDailySummaryFlexBubble({
      totalProducts: 50,
      inStockCount: 40,
      lowStockCount: 7,
      outOfStockCount: 3,
      totalEstimatedCost: 12500,
      reorderCount: 10,
    });

    expect(requiredAt(flex.contents.header.contents, 0).size).toBe("xl");
    expect(requiredAt(flex.contents.header.contents, 1).size).toBe("md");
  });
});
