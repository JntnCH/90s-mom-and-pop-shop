import { describe, expect, it } from "vitest";
import { formatPurchaseOrderSentAt } from "./order-timestamp";

describe("formatPurchaseOrderSentAt", () => {
  it("formats the send time as a Thai Buddhist date and Bangkok time", () => {
    const sentAt = new Date("2026-10-11T00:11:00.000Z");

    expect(formatPurchaseOrderSentAt(sentAt)).toBe("11 ต.ค. 2569 เวลา 07:11 น.");
  });
});
