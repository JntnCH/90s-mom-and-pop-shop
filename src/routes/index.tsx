import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleSlash,
  ClipboardList,
  Coins,
  MessageCircle,
  Package,
  PackagePlus,
  ScanLine,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MasterStore, type ProductItem } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ด | MiniMark" },
      {
        name: "description",
        content: "ภาพรวมสต็อกสินค้า สินค้าใกล้หมด และส่งสั่งซื้อผ่าน LINE",
      },
      { property: "og:title", content: "แดชบอร์ด | MiniMark" },
      { property: "og:description", content: "ภาพรวมสต็อกสินค้าของร้าน MiniMark" },
    ],
  }),
  component: Dashboard,
});

export function Dashboard() {
  const [products, setProducts] = useState<ProductItem[]>([]);

  const load = () => setProducts(MasterStore.getProducts());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const totalProducts = products.length;
  const inStockProducts = products.filter((p) => p.stock > 0).length;
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStockProducts = products.filter((p) => p.stock === 0).length;
  const reorderNeeded = products.filter((p) => p.stock <= p.minStock).length;
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);

  const summary = [
    {
      label: "สินค้าทั้งหมด",
      value: totalProducts,
      unit: "รายการ",
      icon: Package,
      tone: "text-foreground",
    },
    {
      label: "พร้อมขาย",
      value: inStockProducts,
      unit: "รายการ",
      icon: Boxes,
      tone: "text-emerald-600",
    },
    {
      label: "ใกล้หมด (เตือน)",
      value: lowStockProducts,
      unit: "รายการ",
      icon: AlertTriangle,
      tone: "text-amber-500",
    },
    {
      label: "หมดสต็อก",
      value: outOfStockProducts,
      unit: "รายการ",
      icon: CircleSlash,
      tone: "text-destructive",
    },
    {
      label: "ต้องสั่งซื้อ",
      value: reorderNeeded,
      unit: "รายการ",
      icon: ClipboardList,
      tone: "text-sky-600",
    },
    {
      label: "มูลค่าสต็อก (ทุน)",
      value: `฿${totalValue.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`,
      unit: "",
      icon: Coins,
      tone: "text-foreground",
    },
  ];

  const quickActions = [
    {
      to: "/scan",
      label: "สแกนสินค้า",
      desc: "QR / Barcode",
      icon: ScanLine,
      color: "bg-primary/10 text-primary",
    },
    {
      to: "/receive",
      label: "ตรวจรับสินค้า",
      desc: "สแกนเข้าสต็อก",
      icon: PackagePlus,
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      to: "/reorder",
      label: "สั่งซื้อ LINE",
      desc: "ส่ง Flex Message",
      icon: MessageCircle,
      color: "bg-emerald-600 text-white",
    },
    {
      to: "/analytics",
      label: "รายงาน & กำไร",
      desc: "สินค้าขายดี/Margin",
      icon: BarChart3,
      color: "bg-amber-500/10 text-amber-600",
    },
    {
      to: "/products",
      label: "จัดการสินค้า",
      desc: "เพิ่ม/แก้ไข SKU",
      icon: Package,
      color: "bg-sky-500/10 text-sky-600",
    },
    {
      to: "/settings",
      label: "ตั้งค่าระบบ",
      desc: "โซน/หมวด/พนักงาน",
      icon: Settings,
      color: "bg-muted text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      <PageHeader
        title="แดชบอร์ดร้านค้า"
        description="ภาพรวมสถานะสินค้า สต็อกคงเหลือ และการสั่งซื้อผ่าน LINE"
      />

      {/* Primary Mobile Banner: Low Stock Warning if any */}
      {reorderNeeded > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4 text-amber-950 dark:text-amber-200 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">
                มีสินค้า {reorderNeeded} รายการ ถึงจุดสั่งซื้อ
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-300/80 truncate">
                สต็อกต่ำกว่าเกณฑ์ขั้นต่ำ ควรออกใบสั่งซื้อ
              </div>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="h-9 shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold ml-2 shadow-sm active:scale-95"
          >
            <Link to="/reorder">สั่งซื้อ LINE</Link>
          </Button>
        </div>
      ) : null}

      {/* Summary Cards (2 cols on mobile, 3 cols on desktop) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border bg-card p-3 sm:p-4 shadow-sm space-y-1 transition-all"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <item.icon className={`size-3.5 sm:size-4 shrink-0 ${item.tone}`} />
              <span className="truncate">{item.label}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-foreground truncate">
                {item.value}
              </span>
              {item.unit ? (
                <span className="text-[11px] text-muted-foreground font-medium ml-1 shrink-0">
                  {item.unit}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation Cards (Optimized for Mobile Touch) */}
      <div className="space-y-2.5 pt-1">
        <h2 className="text-sm sm:text-base font-bold text-foreground px-0.5">การทำงานด่วน</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col justify-between rounded-2xl border bg-card p-3.5 shadow-sm transition-all hover:border-primary active:scale-95"
            >
              <div
                className={`size-10 rounded-xl flex items-center justify-center mb-3 shadow-xs ${action.color}`}
              >
                <action.icon className="size-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{action.label}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
