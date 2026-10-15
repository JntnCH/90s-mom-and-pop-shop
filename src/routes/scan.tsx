import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Barcode as BarcodeIcon,
  Camera,
  CameraOff,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  Flashlight,
  FlashlightOff,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Printer,
  QrCode,
  RotateCcw,
  ScanLine,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { BarcodeDisplay } from "@/components/barcode/BarcodeDisplay";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormatBadge } from "@/components/master/MasterSelects";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { generateStoreBarcode, inspectBarcode, type BarcodeFormatType } from "@/lib/barcode-engine";
import type { CodeType } from "@/lib/scanner-dedup";
import {
  MasterStore,
  type CategoryItem,
  type ProductItem,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "สแกน & สร้างบาร์โค้ด | โชห่วยยุค90s" },
      {
        name: "description",
        content:
          "สแกนบาร์โค้ดด้วยกล้องเพื่อดูรายละเอียดสินค้าครบถ้วน ตรวจสอบ Check Digit และพิมพ์บาร์โค้ด",
      },
      { property: "og:title", content: "สแกน & สร้างบาร์โค้ด | โชห่วยยุค90s" },
      {
        property: "og:description",
        content: "สแกนบาร์โค้ดและ QR Code เพื่อดูรายละเอียดสินค้าครบวงจร",
      },
    ],
  }),
  component: ScanPage,
});

type ScannedItem = {
  code: string;
  format?: string | undefined;
  type: CodeType;
  at: string;
  matchedProduct?: ProductItem | undefined;
};

function ScanPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"scanner" | "generator">("scanner");
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [manual, setManual] = useState("");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  // Selected item for full detail view / modal
  const [activeScannedItem, setActiveScannedItem] = useState<ScannedItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Barcode Generator Lab State
  const [genFormat, setGenFormat] = useState<BarcodeFormatType>("EAN_13");
  const [genCode, setGenCode] = useState("8850124001153");
  const [genTitle, setGenTitle] = useState("มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง");
  const [genPrice, setGenPrice] = useState<number>(7.0);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const reloadData = useCallback(() => {
    setProducts(MasterStore.getProducts());
    setCategories(MasterStore.getCategories());
    setZones(MasterStore.getZones());
    setUnits(MasterStore.getUnits());
  }, []);

  useEffect(() => {
    reloadData();
    const handleStoreChange = () => reloadData();
    window.addEventListener("minimark_store_change", handleStoreChange);
    window.addEventListener("storage", handleStoreChange);
    return () => {
      window.removeEventListener("minimark_store_change", handleStoreChange);
      window.removeEventListener("storage", handleStoreChange);
    };
  }, [reloadData]);

  const handleDetected = useCallback((code: string, format?: string, type?: CodeType) => {
    const resolvedType = type || (code.toUpperCase().startsWith("QR") ? "QR" : "Barcode");
    const matched = MasterStore.findByBarcode(code);

    const newItem: ScannedItem = {
      code,
      format,
      type: resolvedType,
      at: new Date().toLocaleTimeString("th-TH"),
      matchedProduct: matched,
    };

    setActiveScannedItem(newItem);

    setItems((prev) => {
      const existing = prev.find((i) => i.code === code);
      if (existing) {
        return [newItem, ...prev.filter((i) => i.code !== code)];
      }
      return [newItem, ...prev];
    });

    if (matched) {
      toast.success(`พบสินค้า: ${matched.name}`, {
        description: `บาร์โค้ด ${code} • สต็อกคงเหลือ ${matched.stock} ชิ้น`,
      });
    } else {
      toast.info(`สแกนสำเร็จ [${resolvedType}]: ${code}`, {
        description: "ยังไม่มีสินค้านี้ในระบบ สามารถคลิกลงทะเบียนเพิ่มได้ทันที",
      });
    }
  }, []);

  const {
    videoRef,
    status,
    error,
    permissionDenied,
    supported,
    diagnostics,
    hasTorch,
    isTorchOn,
    toggleTorch,
    start,
    stop,
    resetDeduplication,
  } = useBarcodeScanner(handleDetected, { cooldownMs: 1000 });
  const scanning = status === "scanning" || status === "starting";

  // Generator Action Handlers
  const handleGenerateNewCode = (type: BarcodeFormatType) => {
    const result = generateStoreBarcode(type, "MINI");
    setGenCode(result.barcode);
    setGenFormat(result.format);
    toast.success(`สร้างรหัส ${result.format} สำเร็จ`);
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setGenCode(prod.barcode);
      setGenTitle(prod.name);
      setGenPrice(prod.sellPrice);
      setGenFormat(
        prod.codeType === "QR" ? "QR_CODE" : (prod.format as BarcodeFormatType) || "EAN_13",
      );
    }
  };

  const handleOpenGeneratorWithProduct = (product: ProductItem) => {
    setSelectedProductId(product.id);
    setGenCode(product.barcode);
    setGenTitle(product.name);
    setGenPrice(product.sellPrice);
    setGenFormat(
      product.codeType === "QR" ? "QR_CODE" : (product.format as BarcodeFormatType) || "EAN_13",
    );
    setActiveTab("generator");
  };

  const getCatName = (catId?: string) => categories.find((c) => c.id === catId)?.name || "-";
  const getZoneName = (zoneId?: string) => {
    const z = zones.find((z) => z.id === zoneId);
    return z ? `${z.code} - ${z.name}` : "-";
  };
  const getUnitName = (unitId?: string) => units.find((u) => u.id === unitId)?.name || "ชิ้น";

  const inspection = inspectBarcode(genCode);

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-12">
      {/* 1. Centered Header (แก้ปัญหาหัวข้อไม่อยู่ตรงกลาง) */}
      <PageHeader
        centered
        title="สแกน & สร้างบาร์โค้ด"
        description="สแกนบาร์โค้ดและ QR Code เพื่อดูรายละเอียดสินค้าทั้งหมดในระบบ ตรวจสอบ Check Digit และพิมพ์สติกเกอร์บาร์โค้ด"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-4"
      >
        {/* Centered Tab Switcher */}
        <div className="flex justify-center">
          <TabsList className="grid grid-cols-2 w-full max-w-md h-auto p-1.5 rounded-2xl bg-muted gap-1">
            <TabsTrigger
              value="scanner"
              className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
            >
              <Camera className="size-4" /> สแกนบาร์โค้ด & ตรวจสอบ
            </TabsTrigger>
            <TabsTrigger
              value="generator"
              className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
            >
              <BarcodeIcon className="size-4 text-primary" /> สร้าง & พิมพ์บาร์โค้ด
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: LIVE SCANNER */}
        <TabsContent value="scanner" className="space-y-5">
          {/* CAMERA CARD */}
          <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center justify-center gap-2">
                <ScanLine className="size-5 text-primary" /> สแกนบาร์โค้ดด้วยกล้อง
              </CardTitle>
              <CardDescription className="text-xs">
                รองรับบาร์โค้ดสินค้ามาตรฐาน 1D (EAN-13, UPC, Code 128) และ QR Code 2D
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="relative aspect-[4/3] max-h-72 w-full overflow-hidden rounded-xl bg-black mx-auto max-w-xl border">
                <video
                  ref={videoRef}
                  className="size-full object-cover"
                  muted
                  playsInline
                  aria-label="ภาพจากกล้องสำหรับสแกนบาร์โค้ด"
                />
                {!scanning ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted p-4 text-center">
                    <ScanLine className="size-10 opacity-50" />
                    <p className="text-sm font-semibold text-foreground">
                      แตะปุ่มด้านล่างเพื่อเปิดกล้องสแกน
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      จ่อกล้องให้บาร์โค้ดอยู่ภายในกรอบ ระบบจะอ่านค่าและดึงข้อมูลสินค้าทันที
                    </p>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-6 sm:inset-10 rounded-xl border-2 border-primary/80 animate-pulse flex items-center justify-center">
                    <div className="w-full h-0.5 bg-primary/80 shadow-[0_0_10px_theme(colors.primary.DEFAULT)]" />
                  </div>
                )}
              </div>

              {error ? (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertCircle className="size-4" />
                  <AlertTitle className="text-xs font-semibold">
                    {permissionDenied ? "ไม่ได้รับสิทธิ์กล้อง" : "เกิดข้อผิดพลาด"}
                  </AlertTitle>
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex gap-2 max-w-xl mx-auto">
                {scanning ? (
                  <>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="flex-1 gap-2 rounded-xl h-12 sm:h-13 font-bold text-sm sm:text-base active:scale-98"
                      onClick={stop}
                    >
                      <CameraOff className="size-5" /> ปิดกล้องสแกนเนอร์
                    </Button>
                    {hasTorch && (
                      <Button
                        size="lg"
                        type="button"
                        variant={isTorchOn ? "default" : "outline"}
                        className={`h-12 sm:h-13 px-4 rounded-xl font-semibold transition-all active:scale-98 ${
                          isTorchOn
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                            : ""
                        }`}
                        onClick={() => void toggleTorch()}
                        title={isTorchOn ? "ปิดไฟฉาย" : "เปิดไฟฉายช่วยสแกน"}
                      >
                        {isTorchOn ? (
                          <FlashlightOff className="size-5" />
                        ) : (
                          <Flashlight className="size-5 text-amber-500" />
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="lg"
                    className="w-full gap-2 rounded-xl h-12 sm:h-13 font-bold text-sm sm:text-base shadow-sm bg-primary hover:bg-primary/95 text-primary-foreground active:scale-98"
                    onClick={() => void start()}
                  >
                    <Camera className="size-5" /> เปิดกล้องเพื่อสแกน (ความเร็วสูง)
                  </Button>
                )}
              </div>

              {scanning && (
                <div className="flex items-center justify-center text-[11px] text-muted-foreground px-1">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Zap className="size-3.5 fill-emerald-500 text-emerald-500" />
                    {diagnostics.isNativeAccelerated
                      ? "Hardware Accelerated (60 FPS Native Detection)"
                      : "ZXing Turbo Engine (Optimized Hints)"}
                  </span>
                </div>
              )}

              {/* Manual input form */}
              <form
                suppressHydrationWarning
                className="flex gap-2 max-w-xl mx-auto pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = manual.trim();
                  if (!code) return;
                  handleDetected(
                    code,
                    "MANUAL",
                    code.toUpperCase().startsWith("QR") ? "QR" : "Barcode",
                  );
                  setManual("");
                }}
              >
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="หรือพิมพ์บาร์โค้ด / สแกนผ่านเครื่องสแกนบาร์โค้ด..."
                  className="h-11 text-sm font-mono rounded-xl"
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="secondary"
                  className="rounded-xl h-11 px-5 font-semibold shrink-0"
                >
                  ค้นหาข้อมูล
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 2. FULL SCANNED PRODUCT DETAILS (รายละเอียดของสินค้าทั้งหมด) */}
          {activeScannedItem && (
            <Card className="rounded-2xl border-primary/40 bg-card shadow-md overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-primary/10 px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="size-5 text-primary" />
                  <span className="font-bold text-sm sm:text-base text-foreground">
                    ข้อมูลสินค้าจากการสแกนล่าสุด
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {activeScannedItem.code}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {activeScannedItem.matchedProduct ? (
                    <Badge className="bg-emerald-600 text-white gap-1 text-xs">
                      <CheckCircle2 className="size-3.5" /> พบข้อมูลในระบบ
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertCircle className="size-3.5" /> ไม่พบสินค้านี้ในระบบ
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {activeScannedItem.at}
                  </span>
                </div>
              </div>

              <CardContent className="p-4 sm:p-6">
                {activeScannedItem.matchedProduct ? (
                  (() => {
                    const prod = activeScannedItem.matchedProduct;
                    const margin = prod.sellPrice - prod.costPrice;
                    const marginPercent =
                      prod.sellPrice > 0 ? ((margin / prod.sellPrice) * 100).toFixed(1) : "0";
                    const isOutOfStock = prod.stock <= 0;
                    const isLowStock = prod.stock > 0 && prod.stock <= prod.minStock;

                    return (
                      <div className="space-y-5">
                        {/* Title & Core IDs */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                              {prod.name}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="font-mono font-semibold text-primary">
                                SKU: {prod.sku || "-"}
                              </span>
                              <span>•</span>
                              <span>บาร์โค้ด: {prod.barcode}</span>
                              <span>•</span>
                              <FormatBadge type={prod.codeType} format={prod.format} />
                              <Badge
                                variant={prod.isActive ? "outline" : "secondary"}
                                className="text-[10px]"
                              >
                                {prod.isActive ? "พร้อมขาย" : "ระงับการขาย"}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-xl text-xs gap-1.5"
                              onClick={() => {
                                navigator.clipboard.writeText(prod.barcode);
                                toast.success("คัดลอกรหัสบาร์โค้ดแล้ว");
                              }}
                            >
                              <Copy className="size-3.5" /> คัดลอกรหัส
                            </Button>
                          </div>
                        </div>

                        {/* Detailed Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Stock */}
                          <div className="p-3.5 rounded-xl border bg-muted/30 space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Package className="size-3.5 text-primary" /> สต็อกคงเหลือ
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={`text-2xl font-mono font-bold ${
                                  isOutOfStock
                                    ? "text-destructive"
                                    : isLowStock
                                      ? "text-amber-500"
                                      : "text-emerald-600"
                                }`}
                              >
                                {prod.stock}
                              </span>
                              <span className="text-xs text-muted-foreground font-medium">
                                {getUnitName(prod.unitId)}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-semibold block ${
                                isOutOfStock
                                  ? "text-destructive"
                                  : isLowStock
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                              }`}
                            >
                              {isOutOfStock
                                ? "● สินค้าหมดสต็อก"
                                : isLowStock
                                  ? "● สต็อกต่ำกว่าเกณฑ์"
                                  : "● สต็อกปกติ"}
                            </span>
                          </div>

                          {/* Sell Price */}
                          <div className="p-3.5 rounded-xl border bg-muted/30 space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Tag className="size-3.5 text-emerald-600" /> ราคาขายหน้าร้าน
                            </span>
                            <div className="text-2xl font-mono font-bold text-foreground">
                              ฿
                              {prod.sellPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              ต่อ 1 {getUnitName(prod.unitId)}
                            </span>
                          </div>

                          {/* Cost Price */}
                          <div className="p-3.5 rounded-xl border bg-muted/30 space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <DollarSign className="size-3.5 text-muted-foreground" />{" "}
                              ราคาทุนสินค้า
                            </span>
                            <div className="text-2xl font-mono font-bold text-muted-foreground">
                              ฿
                              {prod.costPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] text-muted-foreground">ต้นทุนจัดซื้อ</span>
                          </div>

                          {/* Margin */}
                          <div className="p-3.5 rounded-xl border bg-muted/30 space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="size-3.5 text-primary" /> อัตรากำไรต่อหน่วย
                            </span>
                            <div className="text-2xl font-mono font-bold text-primary">
                              ฿{margin.toFixed(2)}
                            </div>
                            <span className="text-[10px] font-semibold text-primary">
                              คิดเป็น {marginPercent}% ของราคาขาย
                            </span>
                          </div>
                        </div>

                        {/* Location, Categories & Inventory Thresholds */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/20 p-3.5 rounded-xl border">
                          <div>
                            <span className="text-muted-foreground block font-medium">
                              หมวดหมู่สินค้า:
                            </span>
                            <span className="font-semibold text-foreground">
                              {getCatName(prod.categoryId)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium">
                              โซนจัดเก็บ / ชั้นวาง:
                            </span>
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <MapPin className="size-3.5 text-primary" />{" "}
                              {getZoneName(prod.zoneId)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium">
                              เกณฑ์สั่งซื้อ (Min / Target Par):
                            </span>
                            <span className="font-semibold font-mono text-foreground">
                              เตือนที่ {prod.minStock} • เป้าหมาย {prod.targetStock || 10}{" "}
                              {getUnitName(prod.unitId)}
                            </span>
                          </div>
                        </div>

                        {/* Fast Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                          <Button
                            className="gap-2 rounded-xl h-10 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              navigate({ to: "/issue" });
                            }}
                          >
                            <ShoppingCart className="size-4" /> ขายสินค้านี้ (POS)
                          </Button>

                          <Button
                            variant="secondary"
                            className="gap-2 rounded-xl h-10 font-semibold"
                            onClick={() => {
                              navigate({ to: "/receive" });
                            }}
                          >
                            <PackagePlus className="size-4 text-primary" /> ตรวจรับเข้าสต็อก
                          </Button>

                          <Button
                            variant="outline"
                            className="gap-2 rounded-xl h-10 font-semibold"
                            onClick={() => handleOpenGeneratorWithProduct(prod)}
                          >
                            <Printer className="size-4" /> พิมพ์สติกเกอร์บาร์โค้ด
                          </Button>

                          <Button
                            variant="ghost"
                            className="gap-1.5 rounded-xl h-10 text-xs ml-auto"
                            onClick={() => {
                              setSelectedProductId(prod.id);
                              navigate({ to: "/products" });
                            }}
                          >
                            <ExternalLink className="size-3.5" /> แก้ไขข้อมูลสินค้าในระบบ
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4 py-3 text-center sm:text-left">
                    <div className="space-y-1">
                      <p className="font-bold text-base text-foreground">
                        ไม่พบข้อมูลสินค้าสำหรับรหัสบาร์โค้ด:{" "}
                        <span className="font-mono text-primary">{activeScannedItem.code}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        สินค้านี้ยังไม่ได้ลงทะเบียนในระบบ
                        คุณสามารถบันทึกเป็นสินค้าใหม่เพื่อเปิดขายและจัดการสต็อกได้ทันที
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="gap-2 rounded-xl h-10 font-semibold"
                        onClick={() => {
                          navigate({ to: "/products" });
                        }}
                      >
                        <PackagePlus className="size-4" /> + ลงทะเบียนสินค้าใหม่ด้วยรหัสนี้
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 rounded-xl h-10"
                        onClick={() => {
                          setGenCode(activeScannedItem.code);
                          setActiveTab("generator");
                        }}
                      >
                        <BarcodeIcon className="size-4" /> ตรวจสอบ Check Digit ของรหัสนี้
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Diagnostics Box */}
          <div className="rounded-xl bg-muted/60 p-3 text-xs space-y-1 text-muted-foreground border">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-primary" /> สแกนเนอร์ Diagnostics
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] rounded-lg"
                onClick={resetDeduplication}
              >
                <RotateCcw className="size-3 mr-1" /> รีเซ็ต Cooldown
              </Button>
            </div>
            <p>
              <strong>สถานะกล้อง:</strong> {status} | <strong>กล้องที่รองรับ:</strong>{" "}
              {supported ? "พร้อมใช้งาน" : "ไม่รองรับ"}
            </p>
            <p>
              <strong>ล่าสุดที่สแกนได้:</strong>{" "}
              {diagnostics.lastScannedCode ? (
                <span className="font-mono text-primary font-bold">
                  {diagnostics.lastScannedCode} ({diagnostics.lastScannedType})
                </span>
              ) : (
                "ยังไม่มี"
              )}
            </p>
          </div>

          {/* Scanned Items History */}
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ScanLine className="size-4 text-primary" /> ประวัติรหัสที่สแกนได้ในรอบนี้{" "}
                <Badge variant="secondary" className="font-mono">
                  {items.length}
                </Badge>
              </CardTitle>
              {items.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setItems([]);
                    setActiveScannedItem(null);
                  }}
                >
                  <Trash2 className="size-3.5 mr-1" /> ล้างประวัติ
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  ยังไม่มีรายการที่สแกนได้ในรอบนี้
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {items.map((item) => (
                    <li
                      key={item.code}
                      className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 hover:bg-muted/40 px-2 rounded-xl transition-colors cursor-pointer"
                      onClick={() => setActiveScannedItem(item)}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FormatBadge type={item.type} format={item.format} />
                          <span className="font-mono text-sm font-semibold truncate text-primary">
                            {item.code}
                          </span>
                        </div>
                        {item.matchedProduct ? (
                          <div className="text-xs text-foreground font-medium flex items-center gap-2 flex-wrap">
                            <span className="font-bold">{item.matchedProduct.name}</span>
                            <span>•</span>
                            <span>คงเหลือ: {item.matchedProduct.stock}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-semibold font-mono">
                              ฿{item.matchedProduct.sellPrice.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            (ยังไม่ได้ลงทะเบียนในระบบ)
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {item.at}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveScannedItem(item);
                          }}
                        >
                          <Eye className="size-3" /> ดูข้อมูล
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: BARCODE GENERATOR & TESTING LAB */}
        <TabsContent value="generator" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-12">
            {/* Left: Configuration Form */}
            <div className="md:col-span-6 space-y-4">
              <Card className="rounded-2xl border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" /> เครื่องมือสร้างบาร์โค้ด
                  </CardTitle>
                  <CardDescription className="text-xs">
                    สร้างบาร์โค้ด EAN-13 คำนวณ Check Digit อัตโนมัติ, Code 128 หรือ QR Code
                    สำหรับพิมพ์ติดสินค้า
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3.5">
                  {/* Quick Select from existing products */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      ดึงข้อมูลจากสินค้าในระบบ (เลือกได้)
                    </Label>
                    <select
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-sm"
                      value={selectedProductId}
                      onChange={(e) => handleSelectProduct(e.target.value)}
                    >
                      <option value="">-- กำหนดข้อมูลเองอิสระ --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.barcode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      ประเภทบาร์โค้ด (Barcode Standard) *
                    </Label>
                    <Select
                      value={genFormat}
                      onValueChange={(val) => setGenFormat(val as BarcodeFormatType)}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EAN_13">
                          EAN-13 (มาตรฐานสินค้า 13 หลัก พร้อม Check Digit)
                        </SelectItem>
                        <SelectItem value="CODE_128">
                          Code 128 (รองรับตัวเลขและตัวอักษร Alphanumeric)
                        </SelectItem>
                        <SelectItem value="QR_CODE">QR Code (2 มิติ สแกนได้ทุกทิศทาง)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">รหัสบาร์โค้ด (Data/Barcode) *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-primary"
                        onClick={() => handleGenerateNewCode(genFormat)}
                      >
                        สุ่มรหัสมาตรฐานร้านค้า
                      </Button>
                    </div>
                    <Input
                      className="h-10 font-mono text-sm rounded-xl"
                      value={genCode}
                      onChange={(e) => setGenCode(e.target.value)}
                      placeholder="ใส่รหัสบาร์โค้ด เช่น 8850124..."
                    />
                  </div>

                  {/* Inspection Alert */}
                  <div
                    className={`rounded-xl p-3 text-xs flex items-start gap-2 border ${
                      inspection.isValid
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}
                  >
                    {inspection.isValid ? (
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
                    )}
                    <div className="space-y-0.5">
                      <div className="font-semibold">
                        {inspection.isValid ? "รหัสถูกต้องตามมาตรฐาน" : "รหัสไม่ถูกต้อง"} (
                        {inspection.inferredFormat})
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">{inspection.notes}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">ชื่อสินค้าบนฉลาก</Label>
                      <Input
                        className="h-10 text-xs rounded-xl"
                        value={genTitle}
                        onChange={(e) => setGenTitle(e.target.value)}
                        placeholder="ชื่อสินค้า..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">ราคาขาย (บาท)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        className="h-10 font-mono text-xs rounded-xl"
                        value={genPrice}
                        onChange={(e) => setGenPrice(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Live Visual Preview & Actions */}
            <div className="md:col-span-6 space-y-4">
              <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/40 pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BarcodeIcon className="size-5 text-primary" /> ตัวอย่างฉลากบาร์โค้ด (Live
                      Preview)
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {genFormat}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col items-center justify-center min-h-[260px]">
                  <BarcodeDisplay
                    value={genCode || "000000000000"}
                    format={genFormat}
                    title={genTitle}
                    price={genPrice}
                    width={2.2}
                    height={75}
                    className="w-full max-w-sm"
                    showActions={true}
                  />
                </CardContent>
              </Card>

              {/* Guidelines Card */}
              <Card className="rounded-2xl p-4 text-xs space-y-2 bg-muted/40 border">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Package className="size-4 text-primary" /> ข้อมูลมาตรฐานบาร์โค้ด
                </div>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>
                    <strong>EAN-13:</strong> ขึ้นต้นด้วย <strong>885</strong> (ประเทศไทย) หรือ{" "}
                    <strong>20-29</strong> (สินค้าชั่งน้ำหนัก/ใช้ภายในร้าน) โดยหลักที่ 13 คือ Check
                    Digit
                  </li>
                  <li>
                    <strong>Code 128:</strong> เหมาะสำหรับบาร์โค้ดลังสินค้า, เลขที่ PO, รหัสเอกสาร
                    และ SKU สินค้า
                  </li>
                  <li>
                    <strong>QR Code:</strong> สแกนได้รอบทิศทาง 360 องศา บรรจุข้อมูลได้หลากหลาย
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
