/**
 * Minimal D1 snapshot reader for Cloudflare Workers.
 * Uses env.DB binding — no Postgres / Google Sheets dependency.
 */
export type D1ProductRow = {
  id: string;
  sku: string;
  barcode: string;
  code_type?: string | null;
  format?: string | null;
  name: string;
  image_url?: string | null;
  category_id: string;
  sub_category_id?: string | null;
  zone_id?: string | null;
  unit_id: string;
  cost_price?: number | null;
  sell_price?: number | null;
  stock?: number | null;
  min_stock?: number | null;
  target_stock?: number | null;
  reorder_quantity?: number | null;
  is_active?: number | boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type D1Snapshot = {
  products: Array<{
    id: string;
    sku: string;
    barcode: string;
    codeType: "QR" | "Barcode";
    format?: string;
    name: string;
    imageUrl?: string;
    categoryId: string;
    subCategoryId?: string;
    zoneId?: string;
    unitId: string;
    costPrice: number;
    sellPrice: number;
    stock: number;
    minStock: number;
    targetStock: number;
    reorderQuantity: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  categories: Array<{ id: string; code: string; name: string }>;
  units: Array<{ id: string; name: string; shortName: string }>;
  zones: Array<{ id: string; code: string; name: string; description?: string }>;
  subCategories: Array<{ id: string; categoryId: string; code: string; name: string }>;
  purchaseOrders: unknown[];
  movements: unknown[];
  receives: unknown[];
  followers: unknown[];
};

type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => {
    run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
    all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  };
  run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};

type D1DatabaseLike = {
  prepare: (sql: string) => D1PreparedStatementLike;
  batch?: (statements: unknown[]) => Promise<unknown[]>;
  exec?: (sql: string) => Promise<unknown>;
};

async function getD1Binding(): Promise<D1DatabaseLike | null> {
  // 1. Check cloudflare:workers standard module env
  try {
    const cfName = "cloudflare" + ":workers";
    const mod = (await import(/* @vite-ignore */ cfName)) as { env?: { DB?: D1DatabaseLike } };
    const env = mod?.env;
    if (env?.DB) return env.DB;
  } catch {
    // ignore
  }

  // 2. Check globalThis bindings (common in Nitro / Workers runtimes)
  try {
    const g = globalThis as unknown as {
      DB?: D1DatabaseLike;
      __worker_env__?: { DB?: D1DatabaseLike };
      __env__?: { DB?: D1DatabaseLike };
      process?: { env?: { DB?: D1DatabaseLike } };
    };
    if (g.DB) return g.DB;
    if (g.__worker_env__?.DB) return g.__worker_env__.DB;
    if (g.__env__?.DB) return g.__env__.DB;
    if (g.process?.env?.DB && typeof g.process.env.DB === "object") return g.process.env.DB;
  } catch {
    // ignore
  }

  return null;
}

function mapProduct(row: D1ProductRow) {
  const codeType = row.code_type === "QR" ? "QR" : "Barcode";
  const activeFlag =
    row.is_active === true ||
    row.is_active === 1 ||
    row.is_active === "1" ||
    (typeof row.is_active === "number" && row.is_active !== 0);
  // Default active when column is null/undefined
  const isActive = row.is_active == null ? true : Boolean(activeFlag);
  return {
    id: String(row.id),
    sku: String(row.sku ?? ""),
    barcode: String(row.barcode ?? ""),
    codeType: codeType as "QR" | "Barcode",
    format: row.format ?? undefined,
    name: String(row.name ?? ""),
    imageUrl: row.image_url ?? undefined,
    categoryId: String(row.category_id ?? "cat-general"),
    subCategoryId: row.sub_category_id ?? undefined,
    zoneId: row.zone_id ?? undefined,
    unitId: String(row.unit_id ?? "unit-piece"),
    costPrice: Number(row.cost_price ?? 0),
    sellPrice: Number(row.sell_price ?? 0),
    stock: Number(row.stock ?? 0),
    minStock: Number(row.min_stock ?? 5),
    targetStock: Number(row.target_stock ?? 15),
    reorderQuantity: Number(row.reorder_quantity ?? 15),
    isActive,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

const CAT_CODE: Record<string, string> = {
  "cat-beverage": "BEV",
  "cat-snack": "SNK",
  "cat-food": "FOD",
  "cat-household": "HSH",
  "cat-personal": "PER",
  "cat-general": "GEN",
};

/**
 * Returns null when D1 binding is unavailable (local/Node without Workers).
 * Returns snapshot with products when D1 is bound and reachable.
 */
export async function getD1Snapshot(): Promise<D1Snapshot | null> {
  const db = await getD1Binding();
  if (!db) return null;

  const [productsRes, catsRes, unitsRes, zonesRes] = await Promise.all([
    db
      .prepare("SELECT * FROM products ORDER BY name COLLATE NOCASE")
      .all<D1ProductRow>()
      .catch(() => ({ results: [] })),
    db
      .prepare("SELECT * FROM categories")
      .all<{ id: string; code?: string; name: string }>()
      .catch(() => ({ results: [] })),
    db
      .prepare("SELECT * FROM units")
      .all<{ id: string; name: string; short_name?: string }>()
      .catch(() => ({ results: [] })),
    db
      .prepare("SELECT * FROM zones")
      .all<{ id: string; code?: string; name: string; description?: string }>()
      .catch(() => ({ results: [] })),
  ]);

  let subResults: { id: string; category_id: string; code?: string; name: string }[] = [];
  try {
    const subsRes = await db
      .prepare("SELECT * FROM sub_categories")
      .all<{ id: string; category_id: string; code?: string; name: string }>();
    subResults = subsRes.results || [];
  } catch {
    subResults = [];
  }

  let purchaseOrders: unknown[] = [];
  try {
    const posRes = await db
      .prepare("SELECT * FROM purchase_orders ORDER BY created_at DESC")
      .all<Record<string, unknown>>();
    purchaseOrders = (posRes.results || []).map((row) => ({
      id: String(row["id"]),
      orderNumber: String(row["order_number"] || row["orderNumber"]),
      supplierName: row["supplier_name"] || row["supplierName"] || undefined,
      items: (() => {
        try {
          return typeof row["items_json"] === "string" ? JSON.parse(row["items_json"]) : [];
        } catch {
          return [];
        }
      })(),
      totalQuantity: Number(row["total_quantity"] || 0),
      totalCost: Number(row["total_cost"] || 0),
      status: String(row["status"] || "DRAFT"),
      sentViaLineAt: row["sent_via_line_at"] || undefined,
      createdAt: row["created_at"] || undefined,
      updatedAt: row["updated_at"] || undefined,
    }));
  } catch {
    purchaseOrders = [];
  }

  let movements: unknown[] = [];
  try {
    const movRes = await db
      .prepare("SELECT * FROM stock_movements ORDER BY timestamp DESC LIMIT 500")
      .all<Record<string, unknown>>();
    movements = (movRes.results || []).map((m) => ({
      id: String(m["id"]),
      timestamp: String(m["timestamp"]),
      productId: String(m["product_id"]),
      productName: String(m["product_name"]),
      barcode: String(m["barcode"]),
      type: String(m["type"]),
      quantity: Number(m["quantity"]),
      previousStock: Number(m["previous_stock"]),
      newStock: Number(m["new_stock"]),
      operator: String(m["operator"]),
      note: m["note"] ?? undefined,
    }));
  } catch {
    movements = [];
  }

  let receives: unknown[] = [];
  try {
    const recRes = await db
      .prepare("SELECT * FROM receives ORDER BY scanned_at DESC LIMIT 500")
      .all<Record<string, unknown>>();
    receives = (recRes.results || []).map((r) => ({
      id: String(r["id"]),
      barcode: String(r["barcode"]),
      codeType: String(r["code_type"] || "Barcode"),
      format: r["format"] ?? undefined,
      productName: String(r["product_name"]),
      unit: String(r["unit"]),
      quantity: Number(r["quantity"]),
      scannedAt: String(r["scanned_at"]),
    }));
  } catch {
    receives = [];
  }

  let followers: unknown[] = [];
  try {
    const folRes = await db.prepare("SELECT * FROM line_followers").all<Record<string, unknown>>();
    followers = (folRes.results || []).map((f) => ({
      userId: String(f["user_id"]),
      displayName: String(f["display_name"]),
      pictureUrl: f["picture_url"] ?? undefined,
      statusMessage: f["status_message"] ?? undefined,
      role: String(f["role"] || "staff"),
      followedAt: f["followed_at"] ?? undefined,
      lastInteractionAt: f["last_interaction_at"] ?? undefined,
    }));
  } catch {
    followers = [];
  }

  const products = (productsRes.results || []).map(mapProduct);
  const categories = (catsRes.results || []).map((c) => ({
    id: c.id,
    code: c.code || CAT_CODE[c.id] || c.id.replace(/^cat-/, "").slice(0, 3).toUpperCase() || "GEN",
    name: c.name,
  }));
  const units = (unitsRes.results || []).map((u) => ({
    id: u.id,
    name: u.name,
    shortName: u.short_name || u.name,
  }));
  const zones = (zonesRes.results || []).map((z) => ({
    id: z.id,
    code: z.code || z.id,
    name: z.name,
    description: z.description,
  }));
  const subCategories = subResults.map((s) => ({
    id: s.id,
    categoryId: s.category_id,
    code: s.code || s.id,
    name: s.name,
  }));

  return {
    products,
    categories,
    units,
    zones,
    subCategories,
    purchaseOrders,
    movements,
    receives,
    followers,
  };
}

export async function isD1Available(): Promise<boolean> {
  const db = await getD1Binding();
  return db != null;
}

export interface D1SyncPayload {
  products?: Array<{
    id: string;
    sku: string;
    barcode: string;
    codeType?: "QR" | "Barcode";
    format?: string;
    name: string;
    imageUrl?: string;
    categoryId: string;
    subCategoryId?: string;
    zoneId?: string;
    unitId: string;
    costPrice?: number;
    sellPrice?: number;
    stock?: number;
    minStock?: number;
    targetStock?: number;
    reorderQuantity?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  categories?: Array<{ id: string; code: string; name: string }>;
  subCategories?: Array<{ id: string; categoryId: string; code: string; name: string }>;
  deletedSubCategoryIds?: string[];
  zones?: Array<{ id: string; code: string; name: string; description?: string }>;
  replaceZones?: boolean;
  deletedZoneIds?: string[];
  units?: Array<{ id: string; name: string; shortName: string }>;
  purchaseOrders?: Array<{
    id: string;
    orderNumber: string;
    supplierName?: string;
    items?: unknown[];
    totalQuantity?: number;
    totalCost?: number;
    status?: string;
    sentViaLineAt?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  deletedPurchaseOrderIds?: string[];
  movements?: Array<{
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
  }>;
  receives?: Array<{
    id: string;
    barcode: string;
    codeType?: string;
    format?: string;
    productName: string;
    unit: string;
    quantity: number;
    scannedAt: string;
  }>;
  followers?: Array<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
    role?: string;
    followedAt?: string;
    lastInteractionAt?: string;
  }>;
}

/**
 * Write and persist changes directly into Cloudflare D1 tables (Primary Database).
 * Supports zones, categories, sub_categories, units, products, purchase_orders,
 * stock_movements, receives, and line_followers.
 */
export async function syncD1Payload(payload: D1SyncPayload): Promise<D1Snapshot | null> {
  const db = await getD1Binding();
  if (!db) return null;

  // 1. Ensure core schema tables exist in D1
  try {
    if (typeof db.exec === "function") {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS zones (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT);
        CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sub_categories (id TEXT PRIMARY KEY, category_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          sku TEXT NOT NULL,
          barcode TEXT NOT NULL,
          code_type TEXT DEFAULT 'Barcode',
          format TEXT DEFAULT 'EAN_13',
          name TEXT NOT NULL,
          image_url TEXT,
          category_id TEXT NOT NULL,
          sub_category_id TEXT,
          zone_id TEXT,
          unit_id TEXT NOT NULL,
          cost_price REAL DEFAULT 0,
          sell_price REAL DEFAULT 0,
          stock INTEGER DEFAULT 0,
          min_stock INTEGER DEFAULT 5,
          target_stock INTEGER DEFAULT 15,
          reorder_quantity INTEGER DEFAULT 15,
          is_active INTEGER DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          order_number TEXT NOT NULL,
          supplier_name TEXT,
          items_json TEXT NOT NULL,
          total_quantity INTEGER DEFAULT 0,
          total_cost REAL DEFAULT 0,
          status TEXT DEFAULT 'DRAFT',
          sent_via_line_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          barcode TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          previous_stock INTEGER NOT NULL,
          new_stock INTEGER NOT NULL,
          operator TEXT NOT NULL,
          note TEXT
        );
        CREATE TABLE IF NOT EXISTS receives (
          id TEXT PRIMARY KEY,
          barcode TEXT NOT NULL,
          code_type TEXT DEFAULT 'Barcode',
          format TEXT,
          product_name TEXT NOT NULL,
          unit TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          scanned_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS line_followers (
          user_id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          picture_url TEXT,
          status_message TEXT,
          role TEXT DEFAULT 'staff',
          followed_at TEXT,
          last_interaction_at TEXT
        );
      `);
    } else {
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS zones (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT)",
        )
        .run();
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL)",
        )
        .run();
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS sub_categories (id TEXT PRIMARY KEY, category_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL)",
        )
        .run();
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL)",
        )
        .run();
    }
  } catch (schemaErr) {
    console.warn("[D1 Sync] Table ensure note (tables may already exist):", schemaErr);
  }

  // 2. Upsert Zones
  if (Array.isArray(payload.zones) && payload.zones.length > 0) {
    for (const z of payload.zones) {
      try {
        await db
          .prepare("INSERT OR REPLACE INTO zones (id, code, name, description) VALUES (?, ?, ?, ?)")
          .bind(z.id, z.code || z.id, z.name, z.description ?? null)
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert zone", z.id, err);
      }
    }
  }
  if (Array.isArray(payload.deletedZoneIds) && payload.deletedZoneIds.length > 0) {
    for (const id of payload.deletedZoneIds) {
      try {
        await db.prepare("DELETE FROM zones WHERE id = ?").bind(id).run();
      } catch {
        // ignore
      }
    }
  }

  // 3. Upsert Categories
  if (Array.isArray(payload.categories) && payload.categories.length > 0) {
    for (const c of payload.categories) {
      try {
        await db
          .prepare("INSERT OR REPLACE INTO categories (id, code, name) VALUES (?, ?, ?)")
          .bind(c.id, c.code, c.name)
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert category", c.id, err);
      }
    }
  }

  // 4. Upsert Subcategories
  if (Array.isArray(payload.subCategories) && payload.subCategories.length > 0) {
    for (const sc of payload.subCategories) {
      try {
        await db
          .prepare(
            "INSERT OR REPLACE INTO sub_categories (id, category_id, code, name) VALUES (?, ?, ?, ?)",
          )
          .bind(sc.id, sc.categoryId, sc.code, sc.name)
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert subcategory", sc.id, err);
      }
    }
  }
  if (Array.isArray(payload.deletedSubCategoryIds) && payload.deletedSubCategoryIds.length > 0) {
    for (const id of payload.deletedSubCategoryIds) {
      try {
        await db.prepare("DELETE FROM sub_categories WHERE id = ?").bind(id).run();
      } catch {
        // ignore
      }
    }
  }

  // 5. Upsert Units
  if (Array.isArray(payload.units) && payload.units.length > 0) {
    for (const u of payload.units) {
      try {
        await db
          .prepare("INSERT OR REPLACE INTO units (id, name, short_name) VALUES (?, ?, ?)")
          .bind(u.id, u.name, u.shortName || u.name)
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert unit", u.id, err);
      }
    }
  }

  // 6. Upsert Products
  if (Array.isArray(payload.products) && payload.products.length > 0) {
    for (const p of payload.products) {
      try {
        const activeNum = p.isActive === false ? 0 : 1;
        const nowIso = new Date().toISOString();
        await db
          .prepare(
            `INSERT OR REPLACE INTO products (
              id, sku, barcode, code_type, format, name, image_url, category_id,
              sub_category_id, zone_id, unit_id, cost_price, sell_price, stock,
              min_stock, target_stock, reorder_quantity, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            p.id,
            p.sku || p.barcode || "SKU",
            p.barcode,
            p.codeType || "Barcode",
            p.format || "EAN_13",
            p.name,
            p.imageUrl ?? null,
            p.categoryId,
            p.subCategoryId ?? null,
            p.zoneId ?? null,
            p.unitId,
            p.costPrice ?? 0,
            p.sellPrice ?? 0,
            p.stock ?? 0,
            p.minStock ?? 5,
            p.targetStock ?? 15,
            p.reorderQuantity ?? 15,
            activeNum,
            p.createdAt || nowIso,
            p.updatedAt || nowIso,
          )
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert product", p.id, err);
      }
    }
  }

  // 7. Upsert Purchase Orders
  if (Array.isArray(payload.purchaseOrders) && payload.purchaseOrders.length > 0) {
    for (const po of payload.purchaseOrders) {
      try {
        await db
          .prepare(
            `INSERT OR REPLACE INTO purchase_orders (
              id, order_number, supplier_name, items_json, total_quantity, total_cost, status, sent_via_line_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            po.id,
            po.orderNumber,
            po.supplierName ?? null,
            JSON.stringify(po.items || []),
            po.totalQuantity ?? 0,
            po.totalCost ?? 0,
            po.status ?? "DRAFT",
            po.sentViaLineAt ?? null,
            po.createdAt ?? new Date().toISOString(),
            po.updatedAt ?? new Date().toISOString(),
          )
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert purchase order", po.id, err);
      }
    }
  }

  if (
    Array.isArray(payload.deletedPurchaseOrderIds) &&
    payload.deletedPurchaseOrderIds.length > 0
  ) {
    for (const poId of payload.deletedPurchaseOrderIds) {
      try {
        await db.prepare("DELETE FROM purchase_orders WHERE id = ?").bind(poId).run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to delete purchase order", poId, err);
      }
    }
  }

  // 8. Upsert Stock Movements
  if (Array.isArray(payload.movements) && payload.movements.length > 0) {
    for (const m of payload.movements) {
      try {
        await db
          .prepare(
            `INSERT OR REPLACE INTO stock_movements (
              id, timestamp, product_id, product_name, barcode, type, quantity, previous_stock, new_stock, operator, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            m.id,
            m.timestamp,
            m.productId,
            m.productName,
            m.barcode,
            m.type,
            m.quantity,
            m.previousStock,
            m.newStock,
            m.operator,
            m.note ?? null,
          )
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert movement", m.id, err);
      }
    }
  }

  // 9. Upsert Receives
  if (Array.isArray(payload.receives) && payload.receives.length > 0) {
    for (const r of payload.receives) {
      try {
        await db
          .prepare(
            `INSERT OR REPLACE INTO receives (
              id, barcode, code_type, format, product_name, unit, quantity, scanned_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            r.id,
            r.barcode,
            r.codeType || "Barcode",
            r.format ?? null,
            r.productName,
            r.unit,
            r.quantity,
            r.scannedAt,
          )
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert receive", r.id, err);
      }
    }
  }

  // 10. Upsert Followers
  if (Array.isArray(payload.followers) && payload.followers.length > 0) {
    for (const f of payload.followers) {
      try {
        await db
          .prepare(
            `INSERT OR REPLACE INTO line_followers (
              user_id, display_name, picture_url, status_message, role, followed_at, last_interaction_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            f.userId,
            f.displayName,
            f.pictureUrl ?? null,
            f.statusMessage ?? null,
            f.role || "staff",
            f.followedAt ?? null,
            f.lastInteractionAt ?? null,
          )
          .run();
      } catch (err) {
        console.warn("[D1 Sync] Failed to upsert follower", f.userId, err);
      }
    }
  }

  // Return latest refreshed snapshot directly from D1
  return await getD1Snapshot();
}
