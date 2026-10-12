import { describe, expect, it } from "vitest";

import {
  FLEX_SIMULATOR_JSON_STORAGE_KEY,
  getLatestPurchaseOrderFlexMessage,
  parseFlexSimulatorJson,
  populatePurchaseOrderFlexTemplate,
} from "./flex-simulator-json";

const bubble = {
  type: "bubble",
  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "รายการล่าสุด" }] },
};

describe("LINE Flex Simulator JSON source", () => {
  it("wraps a bubble copied from the simulator without changing its contents", () => {
    const message = parseFlexSimulatorJson(JSON.stringify(bubble));

    expect(message.type).toBe("flex");
    expect(message.altText).toBeTruthy();
    expect(message.contents).toEqual(bubble);
  });

  it("supports a full Flex message and preserves its altText and contents", () => {
    const source = { type: "flex", altText: "PO from Simulator", contents: bubble };

    expect(parseFlexSimulatorJson(JSON.stringify(source))).toEqual(source);
  });

  it("supports a carousel copied directly from the simulator", () => {
    const carousel = { type: "carousel", contents: [bubble] };

    expect(parseFlexSimulatorJson(JSON.stringify(carousel)).contents).toEqual(carousel);
  });

  it("rejects empty, malformed, and non-Flex JSON", () => {
    expect(() => parseFlexSimulatorJson("  ")).toThrow("กรุณาวาง JSON");
    expect(() => parseFlexSimulatorJson("{")).toThrow("รูปแบบ JSON ไม่ถูกต้อง");
    expect(() =>
      parseFlexSimulatorJson(JSON.stringify({ type: "text", text: "not flex" })),
    ).toThrow("รองรับเฉพาะ JSON");
    expect(() => parseFlexSimulatorJson(JSON.stringify({ type: "flex", contents: {} }))).toThrow(
      "contents เป็น bubble หรือ carousel",
    );
  });

  it("reads only the latest textbox value and does not use a generated fallback", () => {
    const storage = {
      getItem: (key: string) =>
        key === FLEX_SIMULATOR_JSON_STORAGE_KEY ? JSON.stringify(bubble) : null,
    };

    expect(getLatestPurchaseOrderFlexMessage(storage).contents).toEqual(bubble);
    expect(() => getLatestPurchaseOrderFlexMessage({ getItem: () => null })).toThrow(
      "ยังไม่มี JSON ในกล่อง LINE Simulator",
    );
  });

  it("fills explicit placeholders and repeats the styled item row for current order items", () => {
    const template = parseFlexSimulatorJson(
      JSON.stringify({
        type: "flex",
        altText: "PO {{orderNumber}} — {{itemCount}} รายการ",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "{{storeName}}" },
              { type: "text", text: "{{supplierName}} • {{orderDate}}" },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "{{productName}}", color: "#123456" },
                  { type: "text", text: "{{quantity}}" },
                  { type: "text", text: "{{unitName}}" },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ยอดรวม" },
                  { type: "text", text: "{{totalCost}}" },
                ],
              },
            ],
          },
        },
      }),
    );
    const message = populatePurchaseOrderFlexTemplate(template, {
      orderNumber: "PO-2026-007",
      orderDate: "11 ต.ค. 2569",
      storeName: "ร้านเจย์",
      supplierName: "ร้านส่ง ก.",
      items: [
        { productName: "น้ำปลา", quantity: 3, unitName: "ขวด", costPrice: 12, total: 36 },
        { productName: "ข้าวสาร", quantity: 1, unitName: "ถุง", costPrice: 20, total: 20 },
      ],
      totalQuantity: 4,
      totalCost: 56,
    });

    const header = message.contents["header"] as { contents: { text: string }[] };
    const body = message.contents["body"] as { contents: Record<string, unknown>[] };
    const itemRows = body.contents.filter((row) => row["spacing"] === "sm");
    const itemCells = itemRows.map((row) => row["contents"] as { text: string; color?: string }[]);

    expect(header.contents.map((cell) => cell.text)).toEqual([
      "ร้านเจย์",
      "ร้านส่ง ก. • 11 ต.ค. 2569",
    ]);
    expect(itemCells.map((cells) => cells.map((cell) => cell.text))).toEqual([
      ["น้ำปลา", "3", "ขวด"],
      ["ข้าวสาร", "1", "ถุง"],
    ]);
    expect(itemCells[0]?.[0]?.color).toBe("#123456");
    expect((body.contents[2]?.["contents"] as { text: string }[])[1]?.text).toBe("฿56.00");
    expect(message.altText).toBe("PO PO-2026-007 — 2 รายการ");
  });

  it("replaces recognizable generated sample rows and summary values without altering layout", () => {
    const template = parseFlexSimulatorJson(
      JSON.stringify({
        type: "flex",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [{ type: "text", text: "🏪 ร้านตัวอย่าง" }],
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                spacing: "sm",
                contents: [
                  { type: "text", text: "1. สินค้าตัวอย่าง", color: "#059669" },
                  { type: "text", text: "5" },
                  { type: "text", text: "แพ็ค" },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "รวมจำนวนสินค้าทั้งหมด" },
                  { type: "text", text: "1 รายการ (5 หน่วย)" },
                ],
              },
            ],
          },
        },
      }),
    );
    const message = populatePurchaseOrderFlexTemplate(template, {
      orderNumber: "DRAFT",
      orderDate: "11 ต.ค. 2569",
      storeName: "ร้านเจย์",
      supplierName: "ซัพพลายเออร์ทั่วไป",
      items: [
        { productName: "น้ำดื่ม", quantity: 2, unitName: "ลัง" },
        { productName: "ขนม", quantity: 4, unitName: "กล่อง" },
      ],
      totalQuantity: 6,
      totalCost: 123,
    });
    const header = message.contents["header"] as { contents: { text: string }[] };
    const body = message.contents["body"] as { contents: Record<string, unknown>[] };
    const itemRows = body.contents.filter((row) => row["spacing"] === "sm");

    expect(header.contents[0]?.text).toBe("🏪 ร้านเจย์");
    expect(itemRows).toHaveLength(2);
    expect(itemRows.map((row) => (row["contents"] as { text: string }[])[0]?.text)).toEqual([
      "1. น้ำดื่ม",
      "2. ขนม",
    ]);
    expect((body.contents[2]?.["contents"] as { text: string }[])[1]?.text).toBe(
      "2 รายการ (6 หน่วย)",
    );
  });

  it("repeats explicit category headings by actual PO category without treating them as item rows", () => {
    const template = parseFlexSimulatorJson(
      JSON.stringify({
        type: "flex",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                backgroundColor: "#eeeeee",
                contents: [
                  { type: "text", text: "🏷️ {{categoryName}}" },
                  { type: "text", text: "{{itemCount}} รายการ" },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "{{productName}}" },
                  { type: "text", text: "{{quantity}}" },
                  { type: "text", text: "{{unitName}}" },
                ],
              },
            ],
          },
        },
      }),
    );
    const message = populatePurchaseOrderFlexTemplate(template, {
      orderNumber: "PO-1",
      orderDate: "11 ต.ค. 2569",
      storeName: "ร้านเจย์",
      supplierName: "ซัพพลายเออร์ ก.",
      items: [
        { productName: "น้ำปลา", quantity: 2, unitName: "ขวด", categoryName: "เครื่องปรุง" },
        { productName: "สบู่", quantity: 1, unitName: "ก้อน", categoryName: "ของใช้" },
      ],
      totalQuantity: 3,
      totalCost: 50,
    });
    const body = message.contents["body"] as { contents: Record<string, unknown>[] };
    const headings = body.contents.filter((row) => row["backgroundColor"] === "#eeeeee");

    expect(
      headings.map((row) => (row["contents"] as { text: string }[]).map((cell) => cell.text)),
    ).toEqual([
      ["🏷️ เครื่องปรุง", "1 รายการ"],
      ["🏷️ ของใช้", "1 รายการ"],
    ]);
    expect(body.contents.filter((row) => row["spacing"] === "sm")).toHaveLength(2);
  });

  it("does not render header banners when groupBy is 'none'", () => {
    const template = parseFlexSimulatorJson(
      JSON.stringify({
        type: "flex",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                backgroundColor: "#eeeeee",
                contents: [
                  { type: "text", text: "🏷️ {{categoryName}}" },
                  { type: "text", text: "{{itemCount}} รายการ" },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "{{productName}}" },
                  { type: "text", text: "{{quantity}}" },
                  { type: "text", text: "{{unitName}}" },
                ],
              },
            ],
          },
        },
      }),
    );
    const message = populatePurchaseOrderFlexTemplate(template, {
      orderNumber: "PO-NONE",
      orderDate: "12 ต.ค. 2569",
      storeName: "ร้านเจย์",
      supplierName: "ซัพพลายเออร์ ก.",
      groupBy: "none",
      items: [
        { productName: "น้ำปลา", quantity: 2, unitName: "ขวด", categoryName: "เครื่องปรุง" },
        { productName: "สบู่", quantity: 1, unitName: "ก้อน", categoryName: "ของใช้" },
      ],
      totalQuantity: 3,
      totalCost: 50,
    });
    const body = message.contents["body"] as { contents: Record<string, unknown>[] };
    const headings = body.contents.filter((row) => row["backgroundColor"] === "#eeeeee");
    expect(headings).toHaveLength(0);
    expect(body.contents.filter((row) => row["spacing"] === "sm")).toHaveLength(2);
  });

  it("renders zone headers when groupBy is 'zone'", () => {
    const template = parseFlexSimulatorJson(
      JSON.stringify({
        type: "flex",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                backgroundColor: "#eeeeee",
                contents: [
                  { type: "text", text: "🏷️ {{categoryName}}" },
                  { type: "text", text: "{{itemCount}} รายการ" },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "{{productName}}" },
                  { type: "text", text: "{{quantity}}" },
                  { type: "text", text: "{{unitName}}" },
                ],
              },
            ],
          },
        },
      }),
    );
    const message = populatePurchaseOrderFlexTemplate(template, {
      orderNumber: "PO-ZONE",
      orderDate: "12 ต.ค. 2569",
      storeName: "ร้านเจย์",
      supplierName: "ซัพพลายเออร์ ก.",
      groupBy: "zone",
      items: [
        { productName: "น้ำปลา", quantity: 2, unitName: "ขวด", zoneName: "ตู้แช่" },
        { productName: "สบู่", quantity: 1, unitName: "ก้อน", zoneName: "หน้าร้าน" },
      ],
      totalQuantity: 3,
      totalCost: 50,
    });
    const body = message.contents["body"] as { contents: Record<string, unknown>[] };
    const headings = body.contents.filter((row) => row["backgroundColor"] === "#eeeeee");
    expect(headings.map((row) => (row["contents"] as { text: string }[])[0]?.text)).toEqual([
      "📍 โซน: ตู้แช่",
      "📍 โซน: หน้าร้าน",
    ]);
  });

  it("sorts by category but suppresses category header when groupBy is 'category_no_header'", () => {
    const template = parseFlexSimulatorJson(
      JSON.stringify({
        type: "flex",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                backgroundColor: "#eeeeee",
                contents: [
                  { type: "text", text: "🏷️ {{categoryName}}" },
                  { type: "text", text: "{{itemCount}} รายการ" },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "{{index}}. {{productName}}" },
                  { type: "text", text: "{{quantity}}" },
                  { type: "text", text: "{{unitName}}" },
                ],
              },
            ],
          },
        },
      }),
    );
    const message = populatePurchaseOrderFlexTemplate(template, {
      orderNumber: "PO-CAT-NO-HEADER",
      orderDate: "12 ต.ค. 2569",
      storeName: "ร้านเจย์",
      supplierName: "ซัพพลายเออร์ ก.",
      groupBy: "category_no_header",
      items: [
        { productName: "สบู่", quantity: 1, unitName: "ก้อน", categoryName: "ของใช้" },
        { productName: "น้ำปลา", quantity: 2, unitName: "ขวด", categoryName: "เครื่องปรุง" },
        { productName: "แชมพู", quantity: 3, unitName: "ขวด", categoryName: "ของใช้" },
      ],
      totalQuantity: 6,
      totalCost: 150,
    });
    const body = message.contents["body"] as { contents: Record<string, unknown>[] };
    const headings = body.contents.filter((row) => row["backgroundColor"] === "#eeeeee");
    // Should NOT have category headings
    expect(headings).toHaveLength(0);

    // Items should be present and sorted by category (ของใช้: สบู่, แชมพู then เครื่องปรุง: น้ำปลา)
    const itemRows = body.contents.filter((row) => row["spacing"] === "sm");
    expect(itemRows).toHaveLength(3);
    const renderedNames = itemRows.map((r) => (r["contents"] as { text: string }[])[0]?.text);
    expect(renderedNames).toEqual(["1. สบู่", "2. แชมพู", "3. น้ำปลา"]);
  });
});
