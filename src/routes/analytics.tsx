import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Coins,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Package,
  PackageCheck,
  PackageMinus,
  PackageX,
  Percent,
  PieChart,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { BarcodeDisplay } from "@/components/barcode/BarcodeDisplay";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AnalyticsService,
  type ProductSalesStat,
  type SalesAnalyticsSummary,
  type TimeRangeFilter,
} from "@/lib/analytics-service";
import { AuthService, type StaffUser } from "@/lib/auth-rbac";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "รายงานยอดขาย & วิเคราะห์กำไร | โชห่วยยุค90s" },
      {
        name: "description",
        content: "รายงานวิเคราะห์ยอดขาย สินค้าขายดี อัตรากำไรขั้นต้น และสินค้าค้างสต็อก",
      },
      { property: "og:title", content: "รายงานยอดขาย & วิเคราะห์กำไร | โชห่วยยุค90s" },
      {
        property: "og:description",
        content: "รายงานวิเคราะห์ยอดขายและอัตรากำไรของร้าน โชห่วยยุค90s",
      },
    ],
  }),
  component: AnalyticsPage,
});

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("ALL");
  const [summary, setSummary] = useState<SalesAnalyticsSummary>(
    AnalyticsService.getAnalyticsSummary("ALL"),
  );
  const [activeTab, setActiveTab] = useState("bestsellers");
  const [marginFilter, setMarginFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<StaffUser>(AuthService.getCurrentUser());

  const canViewCostPrice = AuthService.hasPermission("canViewCostPrice", currentUser);

  const loadData = useCallback(
    (range: TimeRangeFilter = timeRange) => {
      setSummary(AnalyticsService.getAnalyticsSummary(range));
      setCurrentUser(AuthService.getCurrentUser());
    },
    [timeRange],
  );

  useEffect(() => {
    loadData(timeRange);
    const handleStoreChange = () => loadData(timeRange);
    const handleAuthChange = () => {
      setCurrentUser(AuthService.getCurrentUser());
      loadData(timeRange);
    };

    window.addEventListener("minimark_store_change", handleStoreChange);
    window.addEventListener("minimark_auth_change", handleAuthChange);

    return () => {
      window.removeEventListener("minimark_store_change", handleStoreChange);
      window.removeEventListener("minimark_auth_change", handleAuthChange);
    };
  }, [timeRange, loadData]);

  const handleRangeChange = (range: TimeRangeFilter) => {
    setTimeRange(range);
    loadData(range);
  };

  const handleExportCsv = () => {
    try {
      AnalyticsService.exportToCsv(summary);
      toast.success("ดาวน์โหลดรายงานยอดขาย (CSV) เรียบร้อยแล้ว");
    } catch {
      toast.error("ไม่สามารถดาวน์โหลดรายงานได้");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered lists
  const filteredBestSellers = summary.topSellingProducts.filter(
    (p) =>
      p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery),
  );

  const filteredMargins = summary.topSellingProducts
    .filter((p) => {
      if (marginFilter === "HIGH") return p.marginPct >= 30;
      if (marginFilter === "MEDIUM") return p.marginPct >= 15 && p.marginPct < 30;
      if (marginFilter === "LOW") return p.marginPct < 15;
      return true;
    })
    .filter(
      (p) =>
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const topSoldUnitsMax = summary.topSellingProducts[0]?.unitsSold || 1;

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          title="รายงานยอดขาย & วิเคราะห์กำไร"
          description="ภาพรวมรายรับ ต้นทุน อัตรากำไร สินค้าขายดี (Fast-Moving) และสินค้าค้างสต็อก (Dead Stock)"
        />

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:border-primary/50 shadow-xs"
            onClick={handlePrint}
          >
            <Printer className="size-3.5" />
            <span className="hidden sm:inline">พิมพ์รายงาน</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:border-primary/50 text-foreground shadow-xs"
            onClick={handleExportCsv}
          >
            <Download className="size-3.5 text-primary" />
            <span>ส่งออก CSV</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 rounded-xl"
            onClick={() => loadData(timeRange)}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Role permission info banner if cashier */}
      {!canViewCostPrice && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 sm:p-4 text-blue-950 dark:text-blue-200 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="size-6 rounded-lg bg-blue-500/20 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300">
              ℹ
            </span>
            <span>
              คุณกำลังเข้าใช้งานในระดับ <strong>{currentUser.role}</strong> —
              ระบบแสดงเฉพาะยอดจำนวนชิ้นที่ขาย โดยซ่อนต้นทุนและกำไรตามนโยบายความปลอดภัย
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-blue-500/30 text-blue-700 dark:text-blue-300 shrink-0"
          >
            พนักงานหน้าร้าน
          </Badge>
        </div>
      )}

      {/* Time Range Filter Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto p-1.5 rounded-2xl bg-muted/50 border border-border/60">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={timeRange === "ALL" ? "default" : "ghost"}
            className={`h-8 text-xs rounded-xl font-medium ${
              timeRange === "ALL" ? "shadow-xs" : "text-muted-foreground"
            }`}
            onClick={() => handleRangeChange("ALL")}
          >
            ทั้งหมด (All Time)
          </Button>
          <Button
            size="sm"
            variant={timeRange === "TODAY" ? "default" : "ghost"}
            className={`h-8 text-xs rounded-xl font-medium ${
              timeRange === "TODAY" ? "shadow-xs" : "text-muted-foreground"
            }`}
            onClick={() => handleRangeChange("TODAY")}
          >
            วันนี้ (Today)
          </Button>
          <Button
            size="sm"
            variant={timeRange === "THIS_WEEK" ? "default" : "ghost"}
            className={`h-8 text-xs rounded-xl font-medium ${
              timeRange === "THIS_WEEK" ? "shadow-xs" : "text-muted-foreground"
            }`}
            onClick={() => handleRangeChange("THIS_WEEK")}
          >
            สัปดาห์นี้
          </Button>
          <Button
            size="sm"
            variant={timeRange === "THIS_MONTH" ? "default" : "ghost"}
            className={`h-8 text-xs rounded-xl font-medium ${
              timeRange === "THIS_MONTH" ? "shadow-xs" : "text-muted-foreground"
            }`}
            onClick={() => handleRangeChange("THIS_MONTH")}
          >
            เดือนนี้
          </Button>
        </div>

        <div className="hidden sm:flex items-center text-xs text-muted-foreground font-mono pr-2">
          <Calendar className="size-3.5 mr-1" />
          {timeRange === "ALL"
            ? "รวมประวัติทั้งหมด"
            : timeRange === "TODAY"
              ? "ข้อมูลวันนี้ (25 ก.ย. 2026)"
              : timeRange === "THIS_WEEK"
                ? "ข้อมูล 7 วันย้อนหลัง"
                : "กันยายน 2026"}
        </div>
      </div>

      {/* KPI Summary Cards Grid (2 cols mobile, 4 cols desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border bg-card p-3.5 sm:p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <DollarSign className="size-4 text-emerald-600" /> ยอดขายรวม (Revenue)
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0 border-emerald-500/20">
              {summary.totalIssueTransactions} บิล
            </Badge>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-foreground">
            ฿{summary.totalRevenue.toLocaleString("th-TH", { minimumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
            <span>ขายได้ {summary.totalUnitsSold.toLocaleString()} ชิ้น</span>
            <span className="text-emerald-600 font-medium">
              เฉลี่ย ฿{Math.round(summary.averageTransactionValue)}/บิล
            </span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="rounded-2xl border bg-card p-3.5 sm:p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Coins className="size-4 text-primary" /> กำไรขั้นต้น (Gross Profit)
            </span>
            {canViewCostPrice && (
              <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 border-primary/20">
                {summary.profitMarginPct.toFixed(1)}% Margin
              </Badge>
            )}
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-primary">
            {canViewCostPrice
              ? `฿${summary.grossProfit.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`
              : "฿••••••"}
          </div>
          <div className="text-[11px] text-muted-foreground pt-0.5 truncate">
            {canViewCostPrice
              ? `ต้นทุนขาย ฿${summary.totalCogs.toLocaleString("th-TH")}`
              : "สงวนสิทธิ์เฉพาะผู้จัดการ/เจ้าของร้าน"}
          </div>
        </div>

        {/* Current Inventory Valuation (Cost) */}
        <div className="rounded-2xl border bg-card p-3.5 sm:p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Package className="size-4 text-sky-600" /> มูลค่าสต็อกคงเหลือ
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {summary.totalInventoryUnits.toLocaleString()} ชิ้น
            </Badge>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-foreground">
            {canViewCostPrice
              ? `฿${summary.inventoryCostValue.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`
              : `${summary.totalInventoryUnits.toLocaleString()} ชิ้น`}
          </div>
          <div className="text-[11px] text-muted-foreground pt-0.5 truncate">
            {canViewCostPrice
              ? `มูลค่าขายหน้าร้าน ฿${summary.inventoryRetailValue.toLocaleString("th-TH")}`
              : "พร้อมจำหน่ายในร้าน"}
          </div>
        </div>

        {/* Potential Profit in Stock */}
        <div className="rounded-2xl border bg-card p-3.5 sm:p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="size-4 text-amber-500" /> กำไรที่คาดว่าจะได้
            </span>
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0 border-amber-500/20">
              สต็อกปัจจุบัน
            </Badge>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-amber-600">
            {canViewCostPrice
              ? `฿${summary.inventoryPotentialProfit.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`
              : "฿••••••"}
          </div>
          <div className="text-[11px] text-muted-foreground pt-0.5 truncate">
            หากขายสินค้าในสต็อกหมดเกลี้ยง
          </div>
        </div>
      </div>

      {/* Main Analysis Section Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1.5 rounded-2xl bg-muted gap-1">
          <TabsTrigger
            value="bestsellers"
            className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
          >
            <Flame className="size-4 text-orange-500" /> สินค้าขายดี (Top 10)
          </TabsTrigger>
          <TabsTrigger
            value="margins"
            className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
          >
            <Percent className="size-4 text-emerald-600" /> อัตรากำไร (Margin)
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
          >
            <PieChart className="size-4 text-primary" /> ยอดขายตามหมวดหมู่
          </TabsTrigger>
          <TabsTrigger
            value="deadstock"
            className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
          >
            <PackageX className="size-4 text-rose-500" /> สินค้าค้างสต็อก
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BEST SELLERS */}
        <TabsContent value="bestsellers" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="size-5 text-orange-500" /> 10 อันดับสินค้าขายดีที่สุด
                  (Fast-Moving SKUs)
                </CardTitle>
                <CardDescription className="text-xs">
                  เรียงลำดับตามปริมาณชิ้นที่ถูกตัดจำหน่าย/ขายออก (ISSUE) จากระบบสต็อก
                </CardDescription>
              </div>

              <div className="w-full sm:w-64">
                <Input
                  className="h-9 text-xs rounded-xl"
                  placeholder="ค้นหาชื่อ, SKU หรือบาร์โค้ด..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {filteredBestSellers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                  <Package className="size-10 mx-auto text-muted-foreground/50" />
                  <p>ยังไม่มีรายการบันทึกการขาย/เบิกจ่ายในรอบเวลานี้</p>
                  <p className="text-[11px]">
                    คุณสามารถทำการจ่ายสินค้าออกได้ที่เมนู "จ่ายสินค้าออก (Issue)"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Top 3 Visual Podiums for Mobile & Desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                    {filteredBestSellers.slice(0, 3).map((item, idx) => {
                      const medal =
                        idx === 0 ? "🥇 อันดับ 1" : idx === 1 ? "🥈 อันดับ 2" : "🥉 อันดับ 3";
                      const medalBg =
                        idx === 0
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                          : idx === 1
                            ? "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300"
                            : "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300";

                      return (
                        <div
                          key={item.productId}
                          className={`rounded-2xl border p-3.5 flex flex-col justify-between shadow-xs ${medalBg}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{medal}</span>
                            <Badge variant="outline" className="text-[10px] bg-background/60">
                              {item.categoryName}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <div className="font-semibold text-xs text-foreground line-clamp-1">
                              {item.productName}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {item.barcode}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-border/40 flex items-baseline justify-between">
                            <div>
                              <span className="text-lg font-bold font-mono text-foreground">
                                {item.unitsSold}
                              </span>
                              <span className="text-[11px] text-muted-foreground ml-1">ชิ้น</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold font-mono text-emerald-600">
                                ฿{item.totalRevenue.toLocaleString("th-TH")}
                              </div>
                              {canViewCostPrice && (
                                <div className="text-[10px] text-muted-foreground">
                                  กำไร ฿{item.totalProfit.toLocaleString("th-TH")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed Table */}
                  <div className="rounded-xl border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead className="w-56">สินค้า</TableHead>
                          <TableHead className="w-28">หมวดหมู่</TableHead>
                          <TableHead className="w-28 text-center">จำนวนที่ขาย</TableHead>
                          <TableHead className="w-28 text-right">ราคาขาย</TableHead>
                          <TableHead className="w-28 text-right">ยอดขายรวม</TableHead>
                          {canViewCostPrice && (
                            <>
                              <TableHead className="w-28 text-right">กำไรรวม</TableHead>
                              <TableHead className="w-24 text-center">Margin %</TableHead>
                            </>
                          )}
                          <TableHead className="w-24 text-center">สต็อกเหลือ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBestSellers.map((item, idx) => (
                          <TableRow key={item.productId}>
                            <TableCell className="text-center font-bold text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-xs text-foreground line-clamp-1">
                                {item.productName}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {item.barcode} • {item.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {item.categoryName}
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-xs text-foreground">
                              <div className="flex items-center justify-center gap-2">
                                <span>{item.unitsSold}</span>
                                <Progress
                                  value={(item.unitsSold / topSoldUnitsMax) * 100}
                                  className="w-12 h-1.5 bg-muted"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-foreground">
                              ฿{item.sellPrice.toLocaleString("th-TH")}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                              ฿{item.totalRevenue.toLocaleString("th-TH")}
                            </TableCell>
                            {canViewCostPrice && (
                              <>
                                <TableCell className="text-right font-mono font-bold text-xs text-primary">
                                  ฿{item.totalProfit.toLocaleString("th-TH")}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${
                                      item.marginPct >= 30
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        : item.marginPct >= 15
                                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                    }`}
                                  >
                                    {item.marginPct.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-center font-mono text-xs">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  item.currentStock <= 5
                                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                {item.currentStock} ชิ้น
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PROFIT MARGINS */}
        <TabsContent value="margins" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="size-5 text-emerald-600" /> วิเคราะห์อัตรากำไรขั้นต้น (Profit
                  Margins)
                </CardTitle>
                <CardDescription className="text-xs">
                  ตรวจสอบสินค้าที่สร้างผลกำไรสูงสุดและอัตรากำไรต่อชิ้น (Gross Profit Margin %)
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={marginFilter}
                  onValueChange={(val: "ALL" | "HIGH" | "MEDIUM" | "LOW") => setMarginFilter(val)}
                >
                  <SelectTrigger className="h-9 w-40 rounded-xl text-xs">
                    <SelectValue placeholder="ระดับ Margin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทุกระดับ Margin</SelectItem>
                    <SelectItem value="HIGH">กำไรสูง (&gt; 30%)</SelectItem>
                    <SelectItem value="MEDIUM">กำไรปานกลาง (15-30%)</SelectItem>
                    <SelectItem value="LOW">กำไรต่ำ (&lt; 15%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-64">สินค้า</TableHead>
                      <TableHead className="w-28 text-right">ราคาทุน</TableHead>
                      <TableHead className="w-28 text-right">ราคาขาย</TableHead>
                      <TableHead className="w-28 text-right">กำไร / ชิ้น</TableHead>
                      <TableHead className="w-28 text-center">อัตรากำไร (%)</TableHead>
                      <TableHead className="w-24 text-center">ขายได้ (ชิ้น)</TableHead>
                      <TableHead className="w-28 text-right">กำไรรวมสะสม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMargins.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>
                          <div className="font-semibold text-xs text-foreground">
                            {p.productName}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {canViewCostPrice ? `฿${p.costPrice.toFixed(2)}` : "฿•••"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                          ฿{p.sellPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-600">
                          {canViewCostPrice ? `฿${p.unitProfit.toFixed(2)}` : "฿•••"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {canViewCostPrice ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-bold ${
                                p.marginPct >= 30
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : p.marginPct >= 15
                                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {p.marginPct.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">•••</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-foreground">
                          {p.unitsSold}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-primary">
                          {canViewCostPrice
                            ? `฿${p.totalProfit.toLocaleString("th-TH")}`
                            : "฿••••••"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CATEGORY BREAKDOWN */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Visual Share Card */}
            <Card className="rounded-2xl border-border/80 shadow-sm lg:col-span-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="size-5 text-primary" /> สัดส่วนยอดขายตามหมวด
                </CardTitle>
                <CardDescription className="text-xs">
                  เปอร์เซ็นต์ส่วนแบ่งยอดขายของแต่ละกลุ่มสินค้า
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {summary.categoryBreakdown.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{cat.categoryName}</span>
                      <span className="font-mono text-primary font-bold">
                        {cat.revenueSharePct.toFixed(1)}% (฿{cat.totalRevenue.toLocaleString()})
                      </span>
                    </div>
                    <Progress value={cat.revenueSharePct} className="h-2 bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Detailed Category Table */}
            <Card className="rounded-2xl border-border/80 shadow-sm lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="size-5 text-sky-600" /> ตารางประสิทธิภาพกลุ่มสินค้า
                </CardTitle>
                <CardDescription className="text-xs">
                  เปรียบเทียบยอดขาย กำไร และมูลค่าสต็อกที่จมอยู่แต่ละหมวดหมู่
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>หมวดหมู่</TableHead>
                        <TableHead className="text-center">ชิ้นที่ขาย</TableHead>
                        <TableHead className="text-right">ยอดขาย (บาท)</TableHead>
                        {canViewCostPrice && (
                          <TableHead className="text-right">กำไร (บาท)</TableHead>
                        )}
                        <TableHead className="text-center">สต็อกคงเหลือ</TableHead>
                        {canViewCostPrice && (
                          <TableHead className="text-right">มูลค่าสต็อกทุน</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.categoryBreakdown.map((c) => (
                        <TableRow key={c.categoryId}>
                          <TableCell>
                            <div className="font-semibold text-xs text-foreground">
                              {c.categoryName}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {c.categoryCode}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {c.unitsSold}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                            ฿{c.totalRevenue.toLocaleString("th-TH")}
                          </TableCell>
                          {canViewCostPrice && (
                            <TableCell className="text-right font-mono font-bold text-xs text-primary">
                              ฿{c.totalProfit.toLocaleString("th-TH")}
                            </TableCell>
                          )}
                          <TableCell className="text-center font-mono text-xs">
                            {c.currentStockUnits} ชิ้น
                          </TableCell>
                          {canViewCostPrice && (
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              ฿{c.currentStockCostValue.toLocaleString("th-TH")}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: DEAD STOCK & SLOW MOVING */}
        <TabsContent value="deadstock" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PackageX className="size-5 text-rose-500" /> สินค้าค้างสต็อก & เคลื่อนไหวช้า (Dead
                Stock / Slow Moving)
              </CardTitle>
              <CardDescription className="text-xs">
                สินค้าที่มีจำนวนคงคลังแต่ยังไม่มีการเบิกจ่ายออก
                ซึ่งส่งผลให้ทุนจมและเสียโอกาสการหมุนเวียนเงินสด
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {summary.deadStockProducts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                  <CheckCircle2 className="size-10 mx-auto text-emerald-500" />
                  <p className="font-bold text-foreground">
                    ยอดเยี่ยม! ไม่มีสินค้าค้างสต็อกผิดปกติ
                  </p>
                  <p className="text-[11px]">
                    สินค้าทุกรายการมีอัตราการหมุนเวียนและจำหน่ายออกตามเกณฑ์
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-56">สินค้า</TableHead>
                        <TableHead className="w-28 text-center">สต็อกคงเหลือ</TableHead>
                        <TableHead className="w-28 text-right">ทุนที่จมอยู่</TableHead>
                        <TableHead className="w-28 text-center">สถานะความเคลื่อนไหว</TableHead>
                        <TableHead className="w-48 text-left">ข้อแนะนำการบริหาร</TableHead>
                        <TableHead className="w-28 text-right">ดำเนินการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.deadStockProducts.map((p) => {
                        const capitalTied = p.currentStock * p.costPrice;
                        return (
                          <TableRow key={p.productId}>
                            <TableCell>
                              <div className="font-semibold text-xs text-foreground line-clamp-1">
                                {p.productName}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {p.barcode} • {p.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-xs text-foreground">
                              {p.currentStock} ชิ้น
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-rose-600">
                              {canViewCostPrice
                                ? `฿${capitalTied.toLocaleString("th-TH")}`
                                : "฿••••"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px]"
                              >
                                {p.status === "DEAD_STOCK" ? "ค้างสต็อก (0 ขาย)" : "เคลื่อนไหวช้า"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.currentStock >= 15 ? (
                                <span className="text-amber-700 dark:text-amber-300 font-medium">
                                  💡 แนะนำจัดโปรโมชั่นลด 10-15% หรือจับคู่เซ็ต
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  ย้ายตำแหน่งสินค้ามาไว้บริเวณสายตาหน้าร้าน
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 text-[11px] rounded-lg border-border hover:border-primary"
                              >
                                <Link to="/products">จัดการสินค้า</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
