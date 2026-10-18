import type {
  CategoryItem,
  LineUserFollower,
  ProductItem,
  PurchaseOrderRecord,
  ReceiveItem,
  SubCategoryItem,
  StockMovementLog,
  UnitItem,
  ZoneItem,
} from "./store";
import type { getDatabaseSnapshot } from "../db/db-service.ts";

export type LineMessageSendFormat = "FLEX" | "IMAGE_PNG" | "BOTH";

export interface SendLineOrderPayload {
  toUserIdOrGroupId?: string | undefined;
  orderSummary: string;
  flexMessage?: unknown;
  imageBase64?: string | undefined;
  imageUrl?: string | undefined;
  format?: LineMessageSendFormat | undefined;
  channelAccessToken?: string | undefined;
  isBroadcast?: boolean;
}

export interface ServerLineFollower {
  userId: string;
  displayName: string;
  pictureUrl?: string | null | undefined;
  statusMessage?: string | null | undefined;
  followedAt: string;
  lastInteractionAt: string;
  role: "admin" | "staff" | "viewer";
}

export interface ServerSyncPayload {
  lastUpdated?: string | undefined;
  products?: ProductItem[] | undefined;
  categories?: CategoryItem[] | undefined;
  subCategories?: SubCategoryItem[] | undefined;
  deletedSubCategoryIds?: string[] | undefined;
  zones?: ZoneItem[] | undefined;
  units?: UnitItem[] | undefined;
  receives?: ReceiveItem[] | undefined;
  followers?: LineUserFollower[] | undefined;
  movements?: StockMovementLog[] | undefined;
  purchaseOrders?: PurchaseOrderRecord[] | undefined;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type DatabaseSnapshot = Awaited<ReturnType<typeof getDatabaseSnapshot>>;
export type DatabaseFollower = DatabaseSnapshot["followers"][number];
export type SnapshotPurchaseOrder = Omit<DatabaseSnapshot["purchaseOrders"][number], "items"> & {
  items: JsonValue[];
};

export const globalServerDatabase: {
  lastUpdated: string;
  products?: ProductItem[] | DatabaseSnapshot["products"] | undefined;
  categories?: CategoryItem[] | DatabaseSnapshot["categories"] | undefined;
  subCategories?: SubCategoryItem[] | DatabaseSnapshot["subCategories"] | undefined;
  zones?: ZoneItem[] | DatabaseSnapshot["zones"] | undefined;
  units?: UnitItem[] | DatabaseSnapshot["units"] | undefined;
  receives?: ReceiveItem[] | DatabaseSnapshot["receives"] | undefined;
  followers: (ServerLineFollower | DatabaseFollower)[];
  movements?: StockMovementLog[] | DatabaseSnapshot["movements"] | undefined;
  purchaseOrders?: PurchaseOrderRecord[] | SnapshotPurchaseOrder[] | undefined;
} = {
  lastUpdated: new Date().toISOString(),
  subCategories: [],
  followers: [],
};

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") return Object.values(value).every(isJsonValue);
  return false;
}

export const DEFAULT_LINE_LIFF_ID = "2011710264-gaZ7oEcK";

export function getLineChannelAccessToken(): string {
  return (
    process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
    process.env["LINE_ACCESS_TOKEN"] ||
    process.env["LINE_TOKEN"] ||
    process.env["CHANNEL_ACCESS_TOKEN"] ||
    process.env["ACCESS_TOKEN"] ||
    process.env["LINE_BOT_TOKEN"] ||
    process.env["LINE_MESSAGING_TOKEN"] ||
    ""
  ).trim();
}
