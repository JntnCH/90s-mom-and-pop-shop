import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// 1. Users Table (Linked to Firebase Auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  role: text("role").default("staff"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. Zones Table
export const zones = pgTable("zones", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. Categories Table
export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3a. Subcategories Table
export const subCategories = pgTable("sub_categories", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 4. Units Table
export const units = pgTable("units", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. Products Table
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull(),
  barcode: text("barcode").notNull(),
  codeType: text("code_type").default("Barcode"),
  format: text("format").default("EAN_13"),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  categoryId: text("category_id").notNull(),
  subCategoryId: text("sub_category_id"),
  zoneId: text("zone_id"),
  unitId: text("unit_id").notNull(),
  costPrice: doublePrecision("cost_price").default(0),
  sellPrice: doublePrecision("sell_price").default(0),
  stock: integer("stock").default(0),
  minStock: integer("min_stock").default(5),
  targetStock: integer("target_stock").default(15),
  reorderQuantity: integer("reorder_quantity").default(15),
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// 6. Purchase Orders Table
export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  supplierName: text("supplier_name"),
  itemsJson: text("items_json").notNull(), // JSON array string of items
  totalQuantity: integer("total_quantity").default(0),
  totalCost: doublePrecision("total_cost").default(0),
  status: text("status").default("DRAFT"), // DRAFT | ORDERED | RECEIVED | CANCELLED
  sentViaLineAt: text("sent_via_line_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// 7. Stock Movements Table
export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  barcode: text("barcode").notNull(),
  type: text("type").notNull(), // RECEIVE | ISSUE | ADJUST | INITIAL
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  operator: text("operator").notNull(),
  note: text("note"),
});

// 8. Receives Table (Scanned In Records)
export const receives = pgTable("receives", {
  id: text("id").primaryKey(),
  barcode: text("barcode").notNull(),
  codeType: text("code_type").default("Barcode"),
  format: text("format"),
  productName: text("product_name").notNull(),
  unit: text("unit").notNull(),
  quantity: integer("quantity").notNull(),
  scannedAt: text("scanned_at").notNull(),
});

// 9. LINE Followers Table
export const lineFollowers = pgTable("line_followers", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  pictureUrl: text("picture_url"),
  statusMessage: text("status_message"),
  role: text("role").default("staff"),
  followedAt: text("followed_at"),
  lastInteractionAt: text("last_interaction_at"),
});

// 10. Store Configuration Table (centralized shop name / receipt config)
export const storeConfig = pgTable("store_config", {
  id: text("id").primaryKey().default("default"),
  storeName: text("store_name").notNull(),
  branchName: text("branch_name"),
  taxId: text("tax_id"),
  address: text("address"),
  phone: text("phone"),
  headerMessage: text("header_message"),
  footerMessage: text("footer_message"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by"),
});
