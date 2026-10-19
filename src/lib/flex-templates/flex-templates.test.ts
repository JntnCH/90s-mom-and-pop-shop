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
      { name: "น้ำดื่ม 600ml", quantity: 10, unitName: "แพ็ค", costPrice: 50 },
      { name: "มาม่าต้มยำกุ้ง", quantity: 24, unitName: "ซอง", costPrice: 6 },
    ]);

    expect(flex.type).toBe("flex");
    const contents = flex.contents as Record<string, unknown> & {
      body?: { contents: Array<{ contents: Array<{ text: string }> }> };
    };
    expect(contents.type).toBe("bubble");

    const body = contents.body;
    expect(body).toBeDefined();
    const tableHeader = body.contents[0];
    expect(tableHeader.contents.length).toBe(3);
    expect(tableHeader.contents[0].text).toBe("รายการสินค้า");
    expect(tableHeader.contents[1].text).toBe("จำนวน");
    expect(tableHeader.contents[2].text).toBe("หน่วยนับ");
  });

  it("creates LINE Flex Carousel format with multiple cards when containerType is 'carousel'", async () => {
    const { createPurchaseOrderFlex, createPurchaseOrderFlexCarousel } = await import("./index");
    const testItems = [
      {
        name: "น้ำดื่ม 600ml",
        quantity: 10,
        unitName: "แพ็ค",
        costPrice: 50,
        categoryName: "เครื่องดื่ม",
      },
      {
        name: "มาม่าต้มยำกุ้ง",
        quantity: 24,
        unitName: "ซอง",
        costPrice: 6,
        categoryName: "บะหมี่กึ่งสำเร็จรูป",
      },
    ];

    const carousel = createPurchaseOrderFlexCarousel(testItems, {
      storeName: "ร้าน มินิมาร์ท",
      orderNumber: "PO-20261016-001",
    });

    expect(carousel.type).toBe("flex");
    expect(carousel.contents.type).toBe("carousel");
    expect(Array.isArray(carousel.contents.contents)).toBe(true);
    // 2 items < 20 → one card (numbers 1–2), no separate summary card
    expect(carousel.contents.contents.length).toBe(1);

    const flexViaUniversal = createPurchaseOrderFlex(testItems, {
      containerType: "carousel",
    });
    expect(flexViaUniversal.contents.type).toBe("carousel");

    const flexViaBubble = createPurchaseOrderFlex(testItems, {
      containerType: "bubble",
    });
    expect(flexViaBubble.contents.type).toBe("bubble");
  });
});
