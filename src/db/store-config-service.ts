import { eq } from "drizzle-orm";
import { db } from "./index.ts";
import { storeConfig } from "./schema.ts";

export interface StoreConfigRecord {
  id: string;
  storeName: string;
  branchName?: string | null;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  headerMessage?: string | null;
  footerMessage?: string | null;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

export async function getStoreConfig(): Promise<StoreConfigRecord | null> {
  try {
    const rows = await db.select().from(storeConfig).where(eq(storeConfig.id, "default"));
    if (!rows.length) {
      return null;
    }
    return rows[0] as StoreConfigRecord;
  } catch (error) {
    console.error("Failed to get store config:", error);
    return null;
  }
}

export async function upsertStoreConfig(input: {
  storeName: string;
  branchName?: string | null;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  headerMessage?: string | null;
  footerMessage?: string | null;
  updatedBy?: string | null;
}): Promise<StoreConfigRecord | null> {
  try {
    const payload = {
      id: "default",
      storeName: input.storeName.trim(),
      branchName: input.branchName ?? null,
      taxId: input.taxId ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      headerMessage: input.headerMessage ?? null,
      footerMessage: input.footerMessage ?? null,
      updatedAt: new Date(),
      updatedBy: input.updatedBy ?? null,
    };

    const existing = await db.select().from(storeConfig).where(eq(storeConfig.id, "default"));

    if (existing.length > 0) {
      const [updated] = await db
        .update(storeConfig)
        .set(payload)
        .where(eq(storeConfig.id, "default"))
        .returning();
      return updated as StoreConfigRecord;
    }

    const [created] = await db.insert(storeConfig).values(payload).returning();
    return created as StoreConfigRecord;
  } catch (error) {
    console.error("Failed to upsert store config:", error);
    return null;
  }
}
