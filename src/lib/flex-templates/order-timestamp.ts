const THAI_BUDDHIST_LOCALE = "th-TH-u-ca-buddhist-nu-latn";
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

/** Format the order-send timestamp for the purchase-order LINE Flex message. */
export function formatPurchaseOrderSentAt(sentAt: Date = new Date()): string {
  const date = new Intl.DateTimeFormat(THAI_BUDDHIST_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(sentAt);
  const time = new Intl.DateTimeFormat(THAI_BUDDHIST_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(sentAt);

  return `${date} เวลา ${time} น.`;
}
