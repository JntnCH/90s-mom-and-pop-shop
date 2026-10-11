import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./index.ts";
import {
  categories,
  lineFollowers,
  products,
  purchaseOrders,
  receives,
  subCategories,
  stockMovements,
  units,
  users,
  zones,
} from "./schema.ts";

export interface DBProductItem {
  id: string;
  sku: string;
  barcode: string;
  codeType?: "QR" | "Barcode" | undefined;
  format?: string | undefined;
  name: string;
  imageUrl?: string | undefined;
  categoryId: string;
  subCategoryId?: string | undefined;
  zoneId?: string | undefined;
  unitId: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  targetStock: number;
  reorderQuantity: number;
  isActive: boolean;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface DBPurchaseOrder {
  id: string;
  orderNumber: string;
  supplierName?: string | undefined;
  items: unknown[];
  totalQuantity: number;
  totalCost: number;
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
  sentViaLineAt?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export async function getDatabaseSnapshot() {
  try {
    const [
      allUnits,
      allCategories,
      allSubCategories,
      allZones,
      allProducts,
      allPOs,
      allMovements,
      allReceives,
      allFollowers,
    ] = await Promise.all([
      db.select().from(units),
      db.select().from(categories),
      db.select().from(subCategories),
      db.select().from(zones),
      db.select().from(products),
      db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)),
      db.select().from(stockMovements).orderBy(desc(stockMovements.timestamp)),
      db.select().from(receives),
      db.select().from(lineFollowers),
    ]);

    const formattedPOs = allPOs.map((po) => {
      let items: unknown[] = [];
      try {
        items = JSON.parse(po.itemsJson);
      } catch {
        items = [];
      }
      return {
        ...po,
        items,
        status: (po.status as "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED") || "DRAFT",
      };
    });

    const formattedProducts: DBProductItem[] = allProducts.map((p) => ({
      ...p,
      codeType: (p.codeType as "QR" | "Barcode") || "Barcode",
      costPrice: p.costPrice ?? 0,
      sellPrice: p.sellPrice ?? 0,
      stock: p.stock ?? 0,
      minStock: p.minStock ?? 5,
      targetStock: p.targetStock ?? 15,
      reorderQuantity: p.reorderQuantity ?? 15,
      isActive: p.isActive ?? true,
      imageUrl: p.imageUrl ?? undefined,
      subCategoryId: p.subCategoryId ?? undefined,
      zoneId: p.zoneId ?? undefined,
      createdAt: p.createdAt ?? undefined,
      updatedAt: p.updatedAt ?? undefined,
      format: p.format ?? undefined,
    }));

    return {
      units: allUnits,
      categories: allCategories,
      subCategories: allSubCategories,
      zones: allZones,
      products: formattedProducts,
      purchaseOrders: formattedPOs,
      movements: allMovements,
      receives: allReceives,
      followers: allFollowers,
    };
  } catch (error) {
    console.error("Failed to get database snapshot:", error);
    throw new Error("Database query failed.", { cause: error });
  }
}

export async function syncDatabasePayload(payload: {
  units?: { id: string; name: string; shortName: string }[];
  categories?: { id: string; code: string; name: string }[];
  subCategories?: { id: string; categoryId: string; code: string; name: string }[];
  deletedSubCategoryIds?: string[];
  zones?: { id: string; code: string; name: string; description?: string }[];
  products?: DBProductItem[];
  purchaseOrders?: DBPurchaseOrder[];
  movements?: {
    id: string;
    timestamp: string;
    productId: string;
    productName: string;
    barcode: string;
    type: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    operator: string;
    note?: string;
  }[];
  receives?: {
    id: string;
    barcode: string;
    codeType?: string;
    format?: string;
    productName: string;
    unit: string;
    quantity: number;
    scannedAt: string;
  }[];
  followers?: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
    role?: string;
    followedAt?: string;
    lastInteractionAt?: string;
  }[];
}) {
  try {
    // 1. Sync Units
    if (payload.units && payload.units.length > 0) {
      for (const u of payload.units) {
        await db
          .insert(units)
          .values({
            id: u.id,
            name: u.name,
            shortName: u.shortName || u.name,
          })
          .onConflictDoUpdate({
            target: units.id,
            set: {
              name: u.name,
              shortName: u.shortName || u.name,
            },
          });
      }
    }

    // 2. Sync Categories
    if (payload.categories && payload.categories.length > 0) {
      for (const c of payload.categories) {
        await db
          .insert(categories)
          .values({
            id: c.id,
            code: c.code,
            name: c.name,
          })
          .onConflictDoUpdate({
            target: categories.id,
            set: {
              code: c.code,
              name: c.name,
            },
          });
      }
    }

    // 2a. Sync Subcategories
    if (payload.subCategories && payload.subCategories.length > 0) {
      for (const item of payload.subCategories) {
        await db
          .insert(subCategories)
          .values({
            id: item.id,
            categoryId: item.categoryId,
            code: item.code,
            name: item.name,
          })
          .onConflictDoUpdate({
            target: subCategories.id,
            set: {
              categoryId: item.categoryId,
              code: item.code,
              name: item.name,
            },
          });
      }
    }
    if (payload.deletedSubCategoryIds && payload.deletedSubCategoryIds.length > 0) {
      await db
        .delete(subCategories)
        .where(inArray(subCategories.id, payload.deletedSubCategoryIds));
    }

    // 3. Sync Zones
    if (payload.zones && payload.zones.length > 0) {
      for (const z of payload.zones) {
        await db
          .insert(zones)
          .values({
            id: z.id,
            code: z.code,
            name: z.name,
            description: z.description ?? null,
          })
          .onConflictDoUpdate({
            target: zones.id,
            set: {
              code: z.code,
              name: z.name,
              description: z.description ?? null,
            },
          });
      }
    }

    // 4. Sync Products
    if (payload.products && payload.products.length > 0) {
      for (const p of payload.products) {
        await db
          .insert(products)
          .values({
            id: p.id,
            sku: p.sku,
            barcode: p.barcode,
            codeType: p.codeType || "Barcode",
            format: p.format || "EAN_13",
            name: p.name,
            imageUrl: p.imageUrl || null,
            categoryId: p.categoryId,
            subCategoryId: p.subCategoryId || null,
            zoneId: p.zoneId || null,
            unitId: p.unitId,
            costPrice: p.costPrice ?? 0,
            sellPrice: p.sellPrice ?? 0,
            stock: p.stock ?? 0,
            minStock: p.minStock ?? 5,
            targetStock: p.targetStock ?? 15,
            reorderQuantity: p.reorderQuantity ?? 15,
            isActive: p.isActive !== false,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: products.id,
            set: {
              sku: p.sku,
              barcode: p.barcode,
              codeType: p.codeType || "Barcode",
              format: p.format || "EAN_13",
              name: p.name,
              imageUrl: p.imageUrl || null,
              categoryId: p.categoryId,
              subCategoryId: p.subCategoryId || null,
              zoneId: p.zoneId || null,
              unitId: p.unitId,
              costPrice: p.costPrice ?? 0,
              sellPrice: p.sellPrice ?? 0,
              stock: p.stock ?? 0,
              minStock: p.minStock ?? 5,
              targetStock: p.targetStock ?? 15,
              reorderQuantity: p.reorderQuantity ?? 15,
              isActive: p.isActive !== false,
              updatedAt: new Date().toISOString(),
            },
          });
      }
    }

    // 5. Sync Purchase Orders
    if (payload.purchaseOrders && payload.purchaseOrders.length > 0) {
      for (const po of payload.purchaseOrders) {
        await db
          .insert(purchaseOrders)
          .values({
            id: po.id,
            orderNumber: po.orderNumber,
            supplierName: po.supplierName || null,
            itemsJson: JSON.stringify(po.items || []),
            totalQuantity: po.totalQuantity ?? 0,
            totalCost: po.totalCost ?? 0,
            status: po.status || "DRAFT",
            sentViaLineAt: po.sentViaLineAt || null,
            createdAt: po.createdAt || new Date().toISOString(),
            updatedAt: po.updatedAt || new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: purchaseOrders.id,
            set: {
              orderNumber: po.orderNumber,
              supplierName: po.supplierName || null,
              itemsJson: JSON.stringify(po.items || []),
              totalQuantity: po.totalQuantity ?? 0,
              totalCost: po.totalCost ?? 0,
              status: po.status || "DRAFT",
              sentViaLineAt: po.sentViaLineAt || null,
              updatedAt: new Date().toISOString(),
            },
          });
      }
    }

    // 6. Sync Movements
    if (payload.movements && payload.movements.length > 0) {
      for (const m of payload.movements) {
        await db
          .insert(stockMovements)
          .values({
            id: m.id,
            timestamp: m.timestamp,
            productId: m.productId,
            productName: m.productName,
            barcode: m.barcode,
            type: m.type,
            quantity: m.quantity,
            previousStock: m.previousStock,
            newStock: m.newStock,
            operator: m.operator,
            note: m.note || null,
          })
          .onConflictDoNothing();
      }
    }

    // 7. Sync Receives
    if (payload.receives && payload.receives.length > 0) {
      for (const r of payload.receives) {
        await db
          .insert(receives)
          .values({
            id: r.id,
            barcode: r.barcode,
            codeType: r.codeType || "Barcode",
            format: r.format || null,
            productName: r.productName,
            unit: r.unit,
            quantity: r.quantity,
            scannedAt: r.scannedAt,
          })
          .onConflictDoNothing();
      }
    }

    // 8. Sync Followers
    if (payload.followers && payload.followers.length > 0) {
      for (const f of payload.followers) {
        await db
          .insert(lineFollowers)
          .values({
            userId: f.userId,
            displayName: f.displayName,
            pictureUrl: f.pictureUrl || null,
            statusMessage: f.statusMessage || null,
            role: f.role || "staff",
            followedAt: f.followedAt || new Date().toISOString(),
            lastInteractionAt: f.lastInteractionAt || new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: lineFollowers.userId,
            set: {
              displayName: f.displayName,
              pictureUrl: f.pictureUrl || null,
              statusMessage: f.statusMessage || null,
              role: f.role || "staff",
              lastInteractionAt: new Date().toISOString(),
            },
          });
      }
    }

    return await getDatabaseSnapshot();
  } catch (error) {
    console.error("Failed to sync database payload:", error);
    throw new Error("Failed to sync database payload.", { cause: error });
  }
}
