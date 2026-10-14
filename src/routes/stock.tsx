import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash,
  Eye,
  History,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  CategorySelect,
  FormatBadge,
  SubCategorySelect,
  ZoneSelect,
} from "@/components/master/MasterSelects";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  MasterStore,
  type CategoryItem,
  type ProductItem,
  type StockMovementLog,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: "สต็อกสินค้า & ความเคลื่อนไหว | โชห่วยยุค90s" },
      {
        name: "description",
        content: "ตรวจสอบจำนวนสินค้าคงเหลือ จุดสั่งซื้อ ประวัติ Stock Movement และปรับปรุงยอดสต็อก",
      },
      { property: "og:title", content: "สต็อกสินค้า & ความเคลื่อนไหว | โชห่วยยุค90s" },
      {
        property: "og:description",
        content: "เช็คสต็อกสินค้าคงเหลือและประวัติการเคลื่อนไหวในร้าน MiniMark",
      },
    ],
  }),
  component: StockPage,
});

function StockPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [movements, setMovements] = useState<StockMovementLog[]>([]);

  // Filtering
  const [search, setSearch] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedCat, setSelectedCat] = useState("all");
  const [selectedSubCat, setSelectedSubCat] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
  >("ALL");

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductItem | null>(null);
  const [adjustNewStock, setAdjustNewStock] = useState<string>("0");
  const [adjustOperator, setAdjustOperator] = useState("ผู้ดูแลระบบ");
  const [adjustReason, setAdjustReason] = useState("ตรวจนับสต็อกประจำงวด");
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState("");

  // Product Movement History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState<ProductItem | null>(null);

  const load = () => {
    setProducts(MasterStore.getProducts());
    setCategories(MasterStore.getCategories());
    setZones(MasterStore.getZones());
    setUnits(MasterStore.getUnits());
    setMovements(MasterStore.getMovements());
  };

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "ชิ้น";
  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name || id;
  const getZoneName = (id?: string) => (id ? zones.find((z) => z.id === id)?.name || "-" : "-");

  const filtered = products.filter((p) => {
    const query = search.toLowerCase().trim();
    const matchQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.barcode.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query));

    const matchZone = selectedZone === "all" || p.zoneId === selectedZone;
    const matchCat = selectedCat === "all" || p.categoryId === selectedCat;
    const matchSubCat = selectedSubCat === "all" || p.subCategoryId === selectedSubCat;

    const isOut = p.stock <= 0;
    const isLow = !isOut && p.stock <= p.minStock;

    let matchStatus = true;
    if (stockStatusFilter === "OUT_OF_STOCK") matchStatus = isOut;
    else if (stockStatusFilter === "LOW_STOCK") matchStatus = isLow;
    else if (stockStatusFilter === "IN_STOCK") matchStatus = !isOut && !isLow;

    return matchQuery && matchCat && matchZone && matchStatus;
  });

  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const normalStockCount = products.filter((p) => p.stock > p.minStock).length;

  const handleOpenAdjust = (product: ProductItem) => {
    setAdjustingProduct(product);
    setAdjustNewStock(String(product.stock));
    setAdjustOperator("ผู้จัดการร้าน / ผู้ดูแลระบบ");
    setAdjustReason("ตรวจนับสต็อกจริงหน้าร้าน");
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = () => {
    if (!adjustingProduct) return;

    const parsedStock = adjustNewStock.trim() === "" ? 0 : Number(adjustNewStock);
    const validStock = isNaN(parsedStock) ? 0 : Math.max(0, parsedStock);

    const res = MasterStore.adjustStock(
      adjustingProduct.id,
      validStock,
      adjustOperator.trim() || "ผู้ดูแลระบบ",
      adjustReason.trim() || "ปรับยอดสต็อก",
    );

    if (res.success) {
      setAdjustSuccessMsg(
        `ปรับปรุงยอด "${adjustingProduct.name}" จากเดิม ${adjustingProduct.stock} เป็น ${validStock} สำเร็จ (บันทึกประวัติ Movement เรียบร้อยแล้ว)`,
      );
      setAdjustModalOpen(false);
      setAdjustingProduct(null);
      setTimeout(() => setAdjustSuccessMsg(""), 5000);
      load();
    }
  };

  const handleOpenHistory = (product: ProductItem) => {
    setSelectedProductHistory(product);
    setHistoryModalOpen(true);
  };

  const productSpecificMovements = selectedProductHistory
    ? movements.filter(
        (m) =>
          m.productId === selectedProductHistory.id || m.barcode === selectedProductHistory.barcode,
      )
    : [];

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      <PageHeader
        title="สต็อกสินค้า & ความเคลื่อนไหว (Phase 3)"
        description="ตรวจสอบจำนวนคงเหลือ ปรับปรุงยอดสต็อก และดูประวัติ Stock Movement บันทึกทุกรายการรับ-จ่าย"
      />

      {adjustSuccessMsg ? (
        <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded-2xl">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <AlertTitle className="font-semibold text-sm">ปรับปรุงสต็อกสำเร็จ</AlertTitle>
          <AlertDescription className="text-xs">{adjustSuccessMsg}</AlertDescription>
        </Alert>
      ) : null}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium">
            สินค้าทั้งหมด
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-0.5">
            {products.length}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-emerald-600 font-medium">สต็อกปกติ</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 mt-0.5">
            {normalStockCount}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-amber-600 font-medium">สต็อกใกล้หมด</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 mt-0.5">
            {lowStockCount}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-destructive font-medium">สินค้าหมด</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-destructive mt-0.5">
            {outOfStockCount}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-3 sm:p-5">
          <div className="grid gap-2.5 sm:grid-cols-12">
            <div className="relative sm:col-span-3">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ, SKU หรือ บาร์โค้ด..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl"
              />
            </div>
            {/* 1. โซนสินค้า */}
            <div className="sm:col-span-2">
              <ZoneSelect
                value={selectedZone === "all" ? "" : selectedZone}
                onChange={(val) => setSelectedZone(val || "all")}
                placeholder="ทุกโซนจัดเก็บ"
                className="h-10 rounded-xl"
              />
            </div>
            {/* 2. หมวดหมู่หลัก */}
            <div className="sm:col-span-3">
              <CategorySelect
                value={selectedCat === "all" ? "" : selectedCat}
                onChange={(val) => {
                  setSelectedCat(val || "all");
                  setSelectedSubCat("all");
                }}
                placeholder="ทุกหมวดหมู่หลัก"
                className="h-10 rounded-xl"
              />
            </div>
            {/* 3. หมวดหมู่ย่อย */}
            <div className="sm:col-span-2">
              <SubCategorySelect
                categoryId={selectedCat}
                value={selectedSubCat === "all" ? "" : selectedSubCat}
                onChange={(val) => setSelectedSubCat(val || "all")}
                placeholder="ทุกหมวดหมู่ย่อย"
                className="h-10 rounded-xl"
              />
            </div>
            {/* สถานะสต็อก */}
            <div className="sm:col-span-2">
              <Select
                value={stockStatusFilter}
                onValueChange={(val) => setStockStatusFilter(val as typeof stockStatusFilter)}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="สถานะสต็อก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทั้งหมด</SelectItem>
                  <SelectItem value="IN_STOCK">สต็อกปกติ</SelectItem>
                  <SelectItem value="LOW_STOCK">ใกล้หมด</SelectItem>
                  <SelectItem value="OUT_OF_STOCK">สินค้าหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MOBILE LIST VIEW */}
      <div className="block md:hidden space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-muted-foreground">
            รายการสต็อก ({filtered.length} / {products.length})
          </span>
          <span className="text-xs text-muted-foreground">แตะเพื่อดูประวัติ / ปรับยอด</span>
        </div>

        {filtered.length === 0 ? (
          <Card className="rounded-2xl p-8 text-center text-muted-foreground">
            <Package className="size-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">ไม่พบข้อมูลสินค้าตามเงื่อนไข</p>
          </Card>
        ) : (
          filtered.map((item) => {
            const isOut = item.stock <= 0;
            const isLow = !isOut && item.stock <= item.minStock;

            return (
              <div
                key={item.id}
                className="rounded-2xl border bg-card p-3.5 shadow-sm space-y-2.5 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-semibold truncate text-muted-foreground">
                      {item.barcode}
                    </span>
                    <FormatBadge type={item.codeType} format={item.format} />
                  </div>
                  <div>
                    {isOut ? (
                      <Badge variant="destructive" className="text-[10px] py-0.5 px-2">
                        <CircleSlash className="size-3 mr-1" /> สินค้าหมด
                      </Badge>
                    ) : isLow ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border-amber-500/30 text-[10px] py-0.5 px-2">
                        <AlertTriangle className="size-3 mr-1" /> ใกล้หมด
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-emerald-600 border-emerald-500/30 text-[10px] py-0.5 px-2"
                      >
                        <CheckCircle2 className="size-3 mr-1" /> ปกติ
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-sm font-semibold text-foreground line-clamp-2">
                  {item.name}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{getCatName(item.categoryId)}</span>
                  <span>•</span>
                  <span>โซน {getZoneName(item.zoneId)}</span>
                </div>

                {/* Quantities and Actions */}
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">คงเหลือ: </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isOut ? "text-destructive" : isLow ? "text-amber-600" : "text-foreground"
                      }`}
                    >
                      {item.stock} {getUnitName(item.unitId)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      (เตือน {item.minStock} / เป้า {item.targetStock || item.reorderQuantity})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 gap-1 rounded-lg"
                      onClick={() => handleOpenHistory(item)}
                    >
                      <History className="size-3" /> ประวัติ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2 rounded-lg"
                      onClick={() => handleOpenAdjust(item)}
                    >
                      ปรับยอด
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <Card className="hidden md:block rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            ตารางตรวจสอบและควบคุมสต็อก ({filtered.length} รายการ)
          </CardTitle>
          <CardDescription>
            ดูจำนวนสต็อกจริง จุดเตือนสั่งซื้อ และตรวจสอบประวัติ Movement ย้อนหลังของสินค้าแต่ละตัว
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">บาร์โค้ด</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>โซนสินค้า</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead className="text-right">จุดเตือนขั้นต่ำ</TableHead>
                  <TableHead className="text-right">เป้าหมายสต็อก</TableHead>
                  <TableHead className="text-center w-28">สถานะ</TableHead>
                  <TableHead className="text-right w-40">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      ไม่พบข้อมูลสินค้าตามเงื่อนไข
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => {
                    const isOut = item.stock <= 0;
                    const isLow = !isOut && item.stock <= item.minStock;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs font-semibold block">
                              {item.barcode}
                            </span>
                            <FormatBadge type={item.codeType} format={item.format} />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getZoneName(item.zoneId)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getCatName(item.categoryId)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isOut
                                ? "text-destructive"
                                : isLow
                                  ? "text-amber-600"
                                  : "text-foreground"
                            }`}
                          >
                            {item.stock} {getUnitName(item.unitId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {item.minStock} {getUnitName(item.unitId)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {item.targetStock || item.reorderQuantity} {getUnitName(item.unitId)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isOut ? (
                            <Badge variant="destructive" className="text-[11px] py-0.5 px-2">
                              <CircleSlash className="size-3 mr-1" /> สินค้าหมด
                            </Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px] py-0.5 px-2">
                              <AlertTriangle className="size-3 mr-1" /> ใกล้หมด
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-emerald-600 border-emerald-500/30 text-[11px] py-0.5 px-2"
                            >
                              <CheckCircle2 className="size-3 mr-1" /> ปกติ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1 rounded-lg"
                              onClick={() => handleOpenHistory(item)}
                              title="ดูประวัติการเคลื่อนไหว"
                            >
                              <History className="size-3.5" /> ประวัติ
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs rounded-lg"
                              onClick={() => handleOpenAdjust(item)}
                            >
                              ปรับยอด
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* STOCK ADJUSTMENT DIALOG */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              ปรับปรุงยอดสต็อกจริง
            </DialogTitle>
            <DialogDescription className="text-xs">
              สินค้า: <span className="font-bold text-foreground">{adjustingProduct?.name}</span>{" "}
              (คงเหลือเดิม: {adjustingProduct?.stock}{" "}
              {adjustingProduct ? getUnitName(adjustingProduct.unitId) : ""})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">จำนวนคงเหลือที่นับได้จริง *</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                className="h-10 font-mono text-base font-bold rounded-xl"
                value={adjustNewStock}
                onChange={(e) => setAdjustNewStock(e.target.value)}
              />
              {adjustingProduct && (
                <p className="text-[11px] text-muted-foreground">
                  ผลต่างสต็อก:{" "}
                  <span
                    className={`font-bold font-mono ${
                      (adjustNewStock === "" ? 0 : Number(adjustNewStock)) -
                        adjustingProduct.stock >
                      0
                        ? "text-emerald-600"
                        : (adjustNewStock === "" ? 0 : Number(adjustNewStock)) -
                              adjustingProduct.stock <
                            0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {(adjustNewStock === "" ? 0 : Number(adjustNewStock)) - adjustingProduct.stock >
                    0
                      ? "+"
                      : ""}
                    {(adjustNewStock === "" ? 0 : Number(adjustNewStock)) - adjustingProduct.stock}{" "}
                    {getUnitName(adjustingProduct.unitId)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">เหตุผลการปรับปรุงสต็อก *</Label>
              <Select value={adjustReason} onValueChange={setAdjustReason}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ตรวจนับสต็อกประจำงวด">ตรวจนับสต็อกประจำงวด</SelectItem>
                  <SelectItem value="สินค้าชำรุด / เสียหาย">สินค้าชำรุด / เสียหาย</SelectItem>
                  <SelectItem value="สินค้าหมดอายุ / เสื่อมสภาพ">
                    สินค้าหมดอายุ / เสื่อมสภาพ
                  </SelectItem>
                  <SelectItem value="ตรวจพบสินค้าเกินในคลัง">ตรวจพบสินค้าเกินในคลัง</SelectItem>
                  <SelectItem value="ปรับปรุงยอดเริ่มต้น">ปรับปรุงยอดเริ่มต้น</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ผู้ทำรายการ (Operator) *</Label>
              <Input
                className="h-10 rounded-xl"
                value={adjustOperator}
                onChange={(e) => setAdjustOperator(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-11 rounded-xl w-full sm:w-auto"
              onClick={() => setAdjustModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-11 rounded-xl w-full sm:w-auto font-semibold"
              onClick={handleSaveAdjustment}
            >
              บันทึกและสร้าง Movement Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRODUCT MOVEMENT HISTORY DIALOG */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="w-[94vw] max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <History className="size-5 text-primary" />
              ประวัติความเคลื่อนไหวสต็อก (Movement Audit Trail)
            </DialogTitle>
            <DialogDescription className="text-xs">
              สินค้า:{" "}
              <span className="font-bold text-foreground">{selectedProductHistory?.name}</span> (
              {selectedProductHistory?.barcode})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {productSpecificMovements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                ยังไม่มีประวัติการเคลื่อนไหวสำหรับสินค้านี้
              </div>
            ) : (
              <div className="space-y-2">
                {productSpecificMovements.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border bg-card p-3 text-xs space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.type === "RECEIVE" ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                            <ArrowDownRight className="size-3" /> รับเข้า (+{m.quantity})
                          </Badge>
                        ) : m.type === "ISSUE" ? (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <ArrowUpRight className="size-3" /> จ่ายออก (-{m.quantity})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <SlidersHorizontal className="size-3" /> ปรับยอด ({m.quantity})
                          </Badge>
                        )}
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {m.timestamp}
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {m.previousStock} ➔{" "}
                        <span className="text-primary font-bold">{m.newStock}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-1.5 mt-1">
                      <span>หมายเหตุ: {m.note || "-"}</span>
                      <span>โดย: {m.operator || "ระบบ"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button className="w-full rounded-xl" onClick={() => setHistoryModalOpen(false)}>
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
