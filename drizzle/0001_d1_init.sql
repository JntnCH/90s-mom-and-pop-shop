CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'staff',
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS sub_categories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  created_at INTEGER
);
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
  order_number TEXT NOT NULL UNIQUE,
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
CREATE TABLE IF NOT EXISTS store_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  store_name TEXT NOT NULL,
  branch_name TEXT,
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  header_message TEXT,
  footer_message TEXT,
  updated_at INTEGER,
  updated_by TEXT
);
