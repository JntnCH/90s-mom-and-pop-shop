import {
  LayoutDashboard,
  Package,
  Boxes,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  History,
  BarChart3,
  Printer,
  Settings,
  ScanLine,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

/** เมนูหลักของระบบ */
export const navItems: NavItem[] = [
  { to: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/documents", label: "เอกสารขาย & บิลรายจ่าย", icon: Receipt },
  { to: "/products", label: "สินค้า", icon: Package },
  { to: "/stock", label: "สต็อกสินค้า", icon: Boxes },
  { to: "/receive", label: "รับสินค้าเข้า", icon: PackagePlus },
  { to: "/issue", label: "จ่ายสินค้าออก", icon: PackageMinus },
  { to: "/reorder", label: "รายการที่ต้องสั่งซื้อ", icon: ClipboardList },
  { to: "/analytics", label: "รายงาน & กำไร", icon: BarChart3 },
  { to: "/history", label: "ประวัติรายการ", icon: History },
  { to: "/scan", label: "สแกนบาร์โค้ด", icon: ScanLine },
  { to: "/printers", label: "เครื่องพิมพ์", icon: Printer },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
];

/** เมนูลัดด้านล่างสำหรับมือถือ */
// Keep the scanner in the visual center of the five-item bottom navigation.
const mobilePaths = ["/", "/documents", "/scan", "/products", "/receive"];

export const mobileNavItems: NavItem[] = mobilePaths
  .map((p) => navItems.find((i) => i.to === p))
  .filter((i): i is NavItem => Boolean(i));
