/**
 * Central Flex Message Templates Export
 */

export const DEFAULT_STORE_NAME = "โชห่วยยุค90s";

/**
 * Returns current store name from argument, local settings storage, or fallback to DEFAULT_STORE_NAME.
 * Prevents stale legacy fallbacks.
 */
export function getSystemStoreName(override?: string): string {
  if (
    override &&
    override.trim() &&
    override.trim() !== "ร้าน โชห่วยยุค 90s" &&
    override.trim() !== "ร้าน โชห่วยยุค90s" &&
    override.trim() !== "ร้าน MiniMark" &&
    override.trim() !== "MiniMark" &&
    override.trim() !== "ร้าน MiniMark (มินิมาร์ท โชว์ห่วย)" &&
    override.trim() !== "ร้าน โชห่วยยุค 90s"
  ) {
    return override.trim();
  }
  if (typeof window !== "undefined") {
    try {
      const explicitName = localStorage.getItem("minimark_store_name");
      if (
        explicitName &&
        explicitName.trim() &&
        explicitName.trim() !== "ร้าน MiniMark" &&
        explicitName.trim() !== "MiniMark" &&
        explicitName.trim() !== "ร้าน โชห่วยยุค 90s"
      ) {
        return explicitName.trim();
      }

      const storeConfig = localStorage.getItem("minimark_store_config");
      if (storeConfig) {
        const parsedCfg = JSON.parse(storeConfig);
        if (
          parsedCfg?.storeName &&
          typeof parsedCfg.storeName === "string" &&
          parsedCfg.storeName.trim() &&
          parsedCfg.storeName.trim() !== "ร้าน MiniMark" &&
          parsedCfg.storeName.trim() !== "MiniMark" &&
          parsedCfg.storeName.trim() !== "ร้าน โชห่วยยุค 90s"
        ) {
          return parsedCfg.storeName.trim();
        }
      }

      const savedReceipt = localStorage.getItem("minimark_receipt_config_v1");
      if (savedReceipt) {
        const parsed = JSON.parse(savedReceipt);
        if (
          parsed?.storeName &&
          typeof parsed.storeName === "string" &&
          parsed.storeName.trim() &&
          parsed.storeName.trim() !== "ร้าน โชห่วยยุค 90s" &&
          parsed.storeName.trim() !== "ร้าน โชห่วยยุค90s" &&
          parsed.storeName !== "ร้าน MiniMark" &&
          parsed.storeName !== "MiniMark" &&
          parsed.storeName !== "ร้าน MiniMark (มินิมาร์ท โชว์ห่วย)" &&
          parsed.storeName !== "ร้าน โชห่วยยุค 90s"
        ) {
          return parsed.storeName.trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_STORE_NAME;
}

export * from "./flex-grouper";
export * from "./purchase-order-flex";
export * from "./stock-alert-flex";
export * from "./daily-summary-flex";
export * from "./mini-app-portal-flex";
