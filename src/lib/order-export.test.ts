import { describe, expect, it } from "vitest";
import { getJsonUtf8ByteLength, toLiffMessages } from "./line-service";
import { buildOrderFlexMessageFromPayload, type ExportOrderPayload } from "./order-export";

describe("order-export LINE Flex Message builder", () => {
  const samplePayload: ExportOrderPayload = {
    orderNumber: "PO-20261014-001",
    createdAt: "14/10/2026 10:30",
    storeName: "โชห่วยยุค90s",
    supplierName: "ยี่ปั๊ว เจริญพาณิชย์",
    items: [
      {
        productName: "ปลาร้า แม่เหรียญ ฝาขาว",
        barcode: "8850123456789",
        categoryName: "เครื่องปรุงรส",
        zoneName: "โซน A (ของแห้ง)",
        quantity: 12,
        unitName: "ขวด",
        costPrice: 25,
        total: 300,
      },
      {
        productName: "น้ำปลา ทิพรส 700 มล.",
        barcode: "8850987654321",
        categoryName: "เครื่องปรุงรส",
        zoneName: "โซน A (ของแห้ง)",
        quantity: 6,
        unitName: "ขวด",
        costPrice: 30,
        total: 180,
      },
    ],
    totalQuantity: 18,
    totalCost: 480,
  };

  it("should build a valid LINE Flex Message object from order payload", () => {
    const flex = buildOrderFlexMessageFromPayload(samplePayload);
    expect(flex).toBeDefined();
    expect(typeof flex).toBe("object");

    const record = flex as Record<string, unknown>;
    expect(record["type"]).toBe("flex");
    expect(typeof record["altText"]).toBe("string");
    expect(record["altText"]).toContain("โชห่วยยุค90s");

    const contents = record["contents"] as Record<string, unknown>;
    expect(contents).toBeDefined();
    expect(contents["type"]).toBe("carousel");
    expect(Array.isArray(contents["contents"])).toBe(true);
  });

  it("should support grouping options when building Flex Message", () => {
    const flex = buildOrderFlexMessageFromPayload(samplePayload, {
      groupBy: "category",
      showGroupHeaders: true,
    });
    expect(flex).toBeDefined();
    const record = flex as Record<string, unknown>;
    expect(record["type"]).toBe("flex");
  });

  it("should preserve original item order when groupBy is 'none'", () => {
    const multiCategoryPayload: ExportOrderPayload = {
      ...samplePayload,
      items: [
        {
          productName: "สินค้าชิ้นแรก (หมวด ข)",
          barcode: "8850000000001",
          categoryName: "ข. ของใช้",
          zoneName: "โซน B",
          quantity: 5,
          unitName: "ชิ้น",
          costPrice: 20,
          total: 100,
        },
        {
          productName: "สินค้าชิ้นที่สอง (หมวด ก)",
          barcode: "8850000000002",
          categoryName: "ก. เครื่องดื่ม",
          zoneName: "โซน A",
          quantity: 10,
          unitName: "ขวด",
          costPrice: 15,
          total: 150,
        },
      ],
    };

    const flex = buildOrderFlexMessageFromPayload(multiCategoryPayload, {
      groupBy: "none",
      showGroupHeaders: false,
      containerType: "bubble",
    });
    const jsonStr = JSON.stringify(flex);
    const firstIdx = jsonStr.indexOf("สินค้าชิ้นแรก (หมวด ข)");
    const secondIdx = jsonStr.indexOf("สินค้าชิ้นที่สอง (หมวด ก)");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it("should split a 94-item PO Flex Carousel (> 50 KB) into multiple valid carousels under LINE's 50 KB limit", () => {
    const largePayload: ExportOrderPayload = {
      orderNumber: "PO-20261106-001",
      createdAt: "06/11/2569 21:05",
      storeName: "โชห่วยยุค90s",
      supplierName: "บจก ไทรงามช้อป",
      items: Array.from({ length: 94 }, (_, i) => ({
        productName: `สินค้าโชห่วยรายการที่ ${i + 1} ขนาดมาตรฐาน`,
        barcode: `885123456${String(i).padStart(4, "0")}`,
        categoryName: "ของใช้เบ็ดเตล็ดในครัวเรือน",
        zoneName: "โซน A",
        quantity: 2,
        unitName: "ชิ้น",
        costPrice: 25,
        total: 50,
      })),
      totalQuantity: 188,
      totalCost: 4700,
    };

    const flexCarousel = buildOrderFlexMessageFromPayload(largePayload, {
      groupBy: "none",
      showGroupHeaders: false,
      containerType: "carousel",
    });

    // Single unsplit carousel for 94 items exceeds 50 KB
    expect(getJsonUtf8ByteLength(flexCarousel.contents)).toBeGreaterThan(50000);

    // toLiffMessages splits it into 2 carousel messages, each safely < 50,000 bytes
    const liffMessages = toLiffMessages(flexCarousel, "รายการใบสั่งซื้อ 94 รายการ".repeat(30));
    expect(liffMessages.length).toBe(2);
    for (const msg of liffMessages) {
      expect(msg.type).toBe("flex");
      if (msg.type === "flex") {
        expect(msg.altText.length).toBeLessThanOrEqual(400);
        expect(getJsonUtf8ByteLength(msg.contents)).toBeLessThan(50000);
      }
    }
  });

  it("should split a 94-item PO Flex Bubble (> 30 KB) into multiple valid bubbles under LINE's 30 KB limit", () => {
    const largePayload: ExportOrderPayload = {
      orderNumber: "PO-20261106-001",
      createdAt: "06/11/2569 21:05",
      storeName: "โชห่วยยุค90s",
      supplierName: "บจก ไทรงามช้อป",
      items: Array.from({ length: 94 }, (_, i) => ({
        productName: `สินค้าโชห่วยรายการที่ ${i + 1} ขนาดมาตรฐาน`,
        barcode: `885123456${String(i).padStart(4, "0")}`,
        categoryName: "ของใช้เบ็ดเตล็ดในครัวเรือน",
        zoneName: "โซน A",
        quantity: 2,
        unitName: "ชิ้น",
        costPrice: 25,
        total: 50,
      })),
      totalQuantity: 188,
      totalCost: 4700,
    };

    const flexBubble = buildOrderFlexMessageFromPayload(largePayload, {
      groupBy: "none",
      showGroupHeaders: false,
      containerType: "bubble",
    });

    // Single unsplit bubble for 94 items exceeds 30 KB
    expect(getJsonUtf8ByteLength(flexBubble.contents)).toBeGreaterThan(30000);

    // toLiffMessages splits it into multiple bubble messages, each safely < 30,000 bytes
    const liffMessages = toLiffMessages(flexBubble, "รายการใบสั่งซื้อ 94 รายการ");
    expect(liffMessages.length).toBeGreaterThan(1);
    expect(liffMessages.length).toBeLessThanOrEqual(5);
    for (const msg of liffMessages) {
      expect(msg.type).toBe("flex");
      if (msg.type === "flex") {
        expect(msg.altText.length).toBeLessThanOrEqual(400);
        expect(getJsonUtf8ByteLength(msg.contents)).toBeLessThan(30000);
      }
    }
  });
});
