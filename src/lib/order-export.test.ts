import { describe, expect, it } from "vitest";
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
});
