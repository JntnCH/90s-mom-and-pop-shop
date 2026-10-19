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

type D1DatabaseLike = {
  prepare: (sql: string) => {
    all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  };
};

async function getD1Binding(): Promise<D1DatabaseLike | null> {
  try {
    // Official TanStack Start + Cloudflare pattern
    const mod = await import("cloudflare:workers");
    const env = (mod as { env?: { DB?: D1DatabaseLike } }).env;
    return env?.DB ?? null;
  } catch {
    return null;
  }
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
    db.prepare("SELECT * FROM products ORDER BY name COLLATE NOCASE").all<D1ProductRow>(),
    db.prepare("SELECT * FROM categories").all<{ id: string; code?: string; name: string }>(),
    db.prepare("SELECT * FROM units").all<{ id: string; name: string; short_name?: string }>(),
    db
      .prepare("SELECT * FROM zones")
      .all<{ id: string; code?: string; name: string; description?: string }>(),
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
    purchaseOrders: [],
    movements: [],
    receives: [],
    followers: [],
  };
}

export async function isD1Available(): Promise<boolean> {
  return (await getD1Binding()) != null;
}
