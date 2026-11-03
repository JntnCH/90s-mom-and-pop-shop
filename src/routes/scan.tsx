import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Barcode as BarcodeIcon,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Clock,
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
  Plus,
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
import { BarcodeLabelSheet } from "@/components/printer/BarcodeLabelSheet";
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

  // LIFF / LINE in-app browser detection (camera & some scripts are restricted)
  const [isLiffEnv, setIsLiffEnv] = useState(false);
  useEffect(() => {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const inLine = /Line\//i.test(ua) || /LIFF/i.test(ua);
      const hasLiff =
        typeof window !== "undefined" && Boolean((window as unknown as { liff?: unknown }).liff);
      setIsLiffEnv(Boolean(inLine || hasLiff));
    } catch {
      setIsLiffEnv(false);
    }
  }, []);

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
  const activeScannedInspection = activeScannedItem ? inspectBarcode(activeScannedItem.code) : null;

  // Quick Register Modal state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [regBarcode, setRegBarcode] = useState("");
  const [regName, setRegName] = useState("");
  const [regCostPrice, setRegCostPrice] = useState<number>(0);
  const [regSellPrice, setRegSellPrice] = useState<number>(0);
  const [regStock, setRegStock] = useState<number>(10);
  const [regMinStock, setRegMinStock] = useState<number>(5);
  const [regUnitId, setRegUnitId] = useState<string>("");
  const [regCategoryId, setRegCategoryId] = useState<string>("");
  const [regZoneId, setRegZoneId] = useState<string>("");
  const [regFormat, setRegFormat] = useState<BarcodeFormatType>("EAN_13");
  const [regCodeType, setRegCodeType] = useState<CodeType>("Barcode");

  // Generator Mode (single vs sheet)
  const [generatorMode, setGeneratorMode] = useState<"single" | "sheet">("single");

  const handleOpenQuickRegister = (code: string, format?: BarcodeFormatType, type?: CodeType) => {
    setRegBarcode(code);
    setRegName("");
    setRegCostPrice(0);
    setRegSellPrice(0);
    setRegStock(10);
    setRegMinStock(5);
    setRegCategoryId(categories[0]?.id || "");
    setRegZoneId(zones[0]?.id || "");
    setRegUnitId(units[0]?.id || "");
    setRegFormat(format || "EAN_13");
    setRegCodeType(type || (code.startsWith("QR") ? "QR" : "Barcode"));
    setRegisterModalOpen(true);
  };

  const handleSaveQuickRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regName.trim();
    if (!cleanName) {
      toast.error("กรุณาระบุชื่อสินค้า");
      return;
    }
    if (MasterStore.checkDuplicateBarcode(regBarcode)) {
      toast.error("รหัสบาร์โค้ดนี้มีอยู่ในระบบแล้ว");
      return;
    }
    const newProduct = MasterStore.addProduct({
      name: cleanName,
      barcode: regBarcode.trim(),
      costPrice: Number(regCostPrice) || 0,
      sellPrice: Number(regSellPrice) || 0,
      stock: Number(regStock) || 0,
      minStock: Number(regMinStock) || 0,
      categoryId: regCategoryId || categories[0]?.id || "cat-food",
      unitId: regUnitId || units[0]?.id || "unit-pcs",
      zoneId: regZoneId || zones[0]?.id || "zone-a",
      codeType: regCodeType,
      format: regFormat,
      isActive: true,
    });
    reloadData();
    toast.success(`ลงทะเบียนสินค้า "${newProduct.name}" สำเร็จ`);
    setRegisterModalOpen(false);

    const updatedItem: ScannedItem = {
      code: newProduct.barcode,
      format: newProduct.format,
      type: newProduct.codeType === "QR" ? "QR" : "Barcode",
      at: new Date().toLocaleTimeString("th-TH"),
      matchedProduct: newProduct,
    };
    setActiveScannedItem(updatedItem);
    setItems((prev) => [updatedItem, ...prev.filter((i) => i.code !== newProduct.barcode)]);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-12">
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

        <TabsContent value="scanner" className="space-y-5">
          {isLiffEnv ? (
            <Alert className="rounded-2xl border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
              <AlertCircle className="size-4 text-amber-600" />
              <AlertTitle className="text-sm font-semibold">กำลังใช้งานผ่าน LINE LIFF</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>
                  กล้องสแกนและบางสคริปต์อาจถูกจำกัดใน WebView ของ LINE (อาจเห็นข้อความ Cross-origin
                  / CORS)
                </p>
                <p className="font-medium">
                  แนะนำ: ใช้ช่องพิมพ์บาร์โค้ดด้านล่าง หรือเปิดหน้านี้นอก LINE (เบราว์เซอร์ภายนอก)
                  เพื่อใช้กล้องเต็มรูปแบบ
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

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

          {/* Scanned Product Details / Unregistered Product Card */}
          {activeScannedItem?.matchedProduct ? (
            <Card className="rounded-2xl border-emerald-500/40 bg-card shadow-md overflow-hidden">
              <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sm sm:text-base text-foreground">
                      พบข้อมูลสินค้าในระบบ (Product Found)
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      สแกนเมื่อ {activeScannedItem.at}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                    {activeScannedItem.matchedProduct.isActive ? "พร้อมขาย" : "ปิดการขาย"}
                  </Badge>
                  <FormatBadge
                    format={
                      activeScannedItem.matchedProduct.format ||
                      activeScannedItem.format ||
                      "EAN_13"
                    }
                  />
                </div>
              </div>

              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* Product Main Title & Visual Barcode */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getCatName(activeScannedItem.matchedProduct.categoryId)}
                      </Badge>
                      {activeScannedItem.matchedProduct.subCategory && (
                        <Badge variant="secondary" className="text-xs">
                          {activeScannedItem.matchedProduct.subCategory}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground flex items-center gap-1"
                      >
                        <MapPin className="size-3 text-primary" />
                        {getZoneName(activeScannedItem.matchedProduct.zoneId)}
                      </Badge>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground break-words">
                      {activeScannedItem.matchedProduct.name}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                      <span>รหัสบาร์โค้ด: {activeScannedItem.matchedProduct.barcode}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.clipboard) {
                            navigator.clipboard.writeText(
                              activeScannedItem.matchedProduct!.barcode,
                            );
                            toast.success("คัดลอกรหัสบาร์โค้ดแล้ว");
                          }
                        }}
                        className="hover:text-primary transition-colors p-1"
                        title="คัดลอกรหัส"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </p>
                  </div>

                  {/* Visual Barcode Display */}
                  <div className="bg-white p-3 rounded-xl border shadow-xs flex flex-col items-center justify-center shrink-0 min-w-[180px]">
                    <BarcodeDisplay
                      value={activeScannedItem.matchedProduct.barcode}
                      format={
                        activeScannedItem.matchedProduct.codeType === "QR"
                          ? "QR_CODE"
                          : (activeScannedItem.matchedProduct.format as BarcodeFormatType) ||
                            "EAN_13"
                      }
                      showText={true}
                      className="max-h-16"
                    />
                  </div>
                </div>

                {/* Metric / Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Price */}
                  <div className="p-3.5 rounded-xl border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="size-3.5 text-emerald-500" /> ราคาขายหน้าร้าน
                    </span>
                    <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                      ฿
                      {activeScannedItem.matchedProduct.sellPrice.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      ต่อ 1 {getUnitName(activeScannedItem.matchedProduct.unitId)}
                    </div>
                  </div>

                  {/* Cost & Margin */}
                  <div className="p-3.5 rounded-xl border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="size-3.5 text-blue-500" /> ราคาทุน / กำไร
                    </span>
                    <div className="text-lg sm:text-xl font-black text-foreground">
                      ฿
                      {activeScannedItem.matchedProduct.costPrice.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold">
                      กำไร +฿
                      {(
                        activeScannedItem.matchedProduct.sellPrice -
                        activeScannedItem.matchedProduct.costPrice
                      ).toFixed(2)}{" "}
                      (
                      {(
                        ((activeScannedItem.matchedProduct.sellPrice -
                          activeScannedItem.matchedProduct.costPrice) /
                          (activeScannedItem.matchedProduct.sellPrice || 1)) *
                        100
                      ).toFixed(0)}
                      %)
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="p-3.5 rounded-xl border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Package className="size-3.5 text-amber-500" /> คงเหลือในสต็อก
                    </span>
                    <div className="text-lg sm:text-xl font-black text-foreground">
                      {activeScannedItem.matchedProduct.stock}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {getUnitName(activeScannedItem.matchedProduct.unitId)}
                      </span>
                    </div>
                    <div>
                      {activeScannedItem.matchedProduct.stock <= 0 ? (
                        <Badge variant="destructive" className="text-[10px] h-4.5 px-1.5">
                          สินค้าหมด
                        </Badge>
                      ) : activeScannedItem.matchedProduct.stock <=
                        activeScannedItem.matchedProduct.minStock ? (
                        <Badge className="bg-amber-500 text-white text-[10px] h-4.5 px-1.5">
                          สต็อกใกล้หมด (ต่ำกว่า {activeScannedItem.matchedProduct.minStock})
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          เตือนสั่งซื้อเมื่อ &le; {activeScannedItem.matchedProduct.minStock}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location / Zone */}
                  <div className="p-3.5 rounded-xl border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3.5 text-violet-500" /> ตำแหน่งจัดวาง
                    </span>
                    <div
                      className="text-sm sm:text-base font-bold text-foreground truncate"
                      title={getZoneName(activeScannedItem.matchedProduct.zoneId)}
                    >
                      {getZoneName(activeScannedItem.matchedProduct.zoneId)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      หน่วยนับ: {getUnitName(activeScannedItem.matchedProduct.unitId)}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="default"
                    className="gap-2 rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-xs active:scale-98"
                    onClick={() =>
                      navigate({
                        to: "/issue",
                        search: {
                          addBarcode: activeScannedItem.matchedProduct!.barcode,
                        } as unknown as Record<string, unknown>,
                      })
                    }
                  >
                    <ShoppingCart className="size-4" /> ขายสินค้านี้ / เปิดบิลขาย
                  </Button>
                  <Button
                    size="default"
                    variant="secondary"
                    className="gap-2 rounded-xl font-semibold active:scale-98"
                    onClick={() =>
                      navigate({
                        to: "/receive",
                        search: {
                          barcode: activeScannedItem.matchedProduct!.barcode,
                        } as unknown as Record<string, unknown>,
                      })
                    }
                  >
                    <PackagePlus className="size-4 text-emerald-600" /> รับเข้าสต็อก
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className="gap-2 rounded-xl font-semibold active:scale-98"
                    onClick={() =>
                      handleOpenGeneratorWithProduct(activeScannedItem.matchedProduct!)
                    }
                  >
                    <Printer className="size-4 text-primary" /> พิมพ์ป้ายบาร์โค้ด
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className="gap-2 rounded-xl font-semibold active:scale-98"
                    onClick={() =>
                      navigate({
                        to: "/products",
                        search: {
                          search: activeScannedItem.matchedProduct!.barcode,
                        } as unknown as Record<string, unknown>,
                      })
                    }
                  >
                    <Tag className="size-4 text-muted-foreground" /> แก้ไขข้อมูลสินค้า
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : activeScannedItem ? (
            /* Unregistered Scanned Barcode Card */
            <Card className="rounded-2xl border-amber-500/40 bg-card shadow-md overflow-hidden">
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100">
                      ยังไม่พบสินค้านี้ในระบบ (Unregistered Product)
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      สแกนเมื่อ {activeScannedItem.at}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-700 dark:text-amber-300 font-semibold"
                >
                  รหัสสินค้าใหม่
                </Badge>
              </div>

              <CardContent className="p-4 sm:p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h4 className="text-base sm:text-lg font-bold text-foreground">
                      รหัสบาร์โค้ด:{" "}
                      <span className="font-mono text-primary font-black">
                        {activeScannedItem.code}
                      </span>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      ระบบตรวจจับรหัสสำเร็จ แต่ยังไม่มีข้อมูลสินค้านี้ในฐานข้อมูลของร้านค้า
                      คุณสามารถคลิกลงทะเบียนเพื่อบันทึกชื่อ ราคา และสต็อกได้ทันที
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {activeScannedItem.format ||
                          activeScannedInspection?.inferredFormat ||
                          "Barcode 1D"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {activeScannedInspection?.isValid
                          ? "✓ มาตรฐาน GS1 ถูกต้อง"
                          : activeScannedInspection?.notes}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border shadow-xs flex flex-col items-center justify-center shrink-0 min-w-[180px]">
                    <BarcodeDisplay
                      value={activeScannedItem.code}
                      format={activeScannedInspection?.inferredFormat || "EAN_13"}
                      showText={true}
                      className="max-h-16"
                    />
                  </div>
                </div>

                {/* Primary Action to register product */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    size="lg"
                    className="flex-1 sm:flex-initial gap-2 rounded-xl h-12 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-98"
                    onClick={() =>
                      handleOpenQuickRegister(
                        activeScannedItem.code,
                        activeScannedInspection?.inferredFormat,
                        activeScannedItem.type,
                      )
                    }
                  >
                    <PackagePlus className="size-5" /> ลงทะเบียนสินค้านี้ทันที (+ เพิ่มสินค้าใหม่)
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-xl h-12 px-4 font-semibold gap-2 active:scale-98"
                    onClick={() => {
                      setGenCode(activeScannedItem.code);
                      setGenFormat(activeScannedInspection?.inferredFormat || "EAN_13");
                      setActiveTab("generator");
                    }}
                  >
                    <Printer className="size-4.5 text-primary" /> สร้างป้ายบาร์โค้ดนี้
                  </Button>

                  <Button
                    size="lg"
                    variant="ghost"
                    className="rounded-xl h-12 px-3 font-semibold text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(activeScannedItem.code);
                        toast.success("คัดลอกรหัสบาร์โค้ดแล้ว");
                      }
                    }}
                  >
                    <Copy className="size-4" /> คัดลอกรหัส
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Guide Placeholder when nothing has been scanned yet */
            <Card className="rounded-2xl border-dashed border-border bg-muted/20 text-center p-6 sm:p-8 space-y-2">
              <ScanLine className="size-10 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">ยังไม่มีรายการสแกนในรอบนี้</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                เล็งกล้องไปที่บาร์โค้ดสินค้า พิมพ์รหัสในช่องค้นหา
                หรือเชื่อมต่อเครื่องสแกนบาร์โค้ดเพื่อดูรายละเอียดสินค้าและจัดการสต็อกทันที
              </p>
            </Card>
          )}

          {/* Session Scan History */}
          {items.length > 0 && (
            <Card className="rounded-2xl border-border/80 shadow-xs">
              <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b">
                <div>
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Clock className="size-4 text-primary" /> ประวัติการสแกนในรอบนี้ ({items.length}
                    )
                  </CardTitle>
                  <CardDescription className="text-xs">
                    แตะที่รายการเพื่อดูรายละเอียดสินค้าทั้งหมดอีกครั้ง
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive h-8 px-2 gap-1"
                  onClick={() => {
                    setItems([]);
                    setActiveScannedItem(null);
                    resetDeduplication();
                    toast.info("ล้างประวัติการสแกนแล้ว");
                  }}
                >
                  <Trash2 className="size-3.5" /> ล้างประวัติ
                </Button>
              </CardHeader>
              <CardContent className="p-0 divide-y max-h-80 overflow-y-auto">
                {items.map((item, idx) => (
                  <div
                    key={`${item.code}-${idx}`}
                    onClick={() => setActiveScannedItem(item)}
                    className={`flex items-center justify-between p-3 sm:px-6 cursor-pointer hover:bg-muted/50 transition-colors ${
                      activeScannedItem?.code === item.code ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                          item.matchedProduct
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {item.matchedProduct ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <PackagePlus className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-foreground truncate">
                          {item.matchedProduct?.name || "ยังไม่ได้ลงทะเบียนสินค้า"}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                          <span>{item.code}</span>
                          <span>•</span>
                          <span>{item.at}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      {item.matchedProduct ? (
                        <div className="text-xs">
                          <span className="font-bold text-emerald-600 block">
                            ฿{item.matchedProduct.sellPrice.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            คงเหลือ {item.matchedProduct.stock}{" "}
                            {getUnitName(item.matchedProduct.unitId)}
                          </span>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-600 border-amber-300"
                        >
                          + ลงทะเบียน
                        </Badge>
                      )}
                      <ArrowRight className="size-3.5 text-muted-foreground/60" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generator" className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-foreground">พิมพ์ป้าย & บาร์โค้ด</h3>
              <p className="text-xs text-muted-foreground">
                เลือกรูปแบบป้ายราคาเดี่ยว หรือพิมพ์สติกเกอร์บาร์โค้ดหลายดวง
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl">
              <Button
                size="sm"
                variant={generatorMode === "single" ? "default" : "ghost"}
                className="h-8 text-xs rounded-lg font-semibold"
                onClick={() => setGeneratorMode("single")}
              >
                ป้ายราคาเดี่ยว
              </Button>
              <Button
                size="sm"
                variant={generatorMode === "sheet" ? "default" : "ghost"}
                className="h-8 text-xs rounded-lg font-semibold"
                onClick={() => setGeneratorMode("sheet")}
              >
                ชุดพิมพ์สติกเกอร์เต็มแผ่น
              </Button>
            </div>
          </div>

          {generatorMode === "sheet" ? (
            <BarcodeLabelSheet initialProductId={selectedProductId} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Generator Configuration Form */}
              <Card className="rounded-2xl border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">ตั้งค่าป้ายบาร์โค้ด</CardTitle>
                  <CardDescription className="text-xs">
                    ดึงข้อมูลจากสินค้าในระบบ หรือระบุรหัสเพื่อสร้างป้ายใหม่
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">เลือกสินค้าจากระบบ (ถ้ามี)</Label>
                    <Select value={selectedProductId} onValueChange={handleSelectProduct}>
                      <SelectTrigger className="h-10 text-xs rounded-xl">
                        <SelectValue placeholder="-- เลือกสินค้าเพื่อดึงข้อมูล --" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name} ({p.barcode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">รูปแบบบาร์โค้ด</Label>
                      <Select
                        value={genFormat}
                        onValueChange={(v) => setGenFormat(v as BarcodeFormatType)}
                      >
                        <SelectTrigger className="h-10 text-xs rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EAN_13">EAN-13 (มาตรฐานสินค้า 13 หลัก)</SelectItem>
                          <SelectItem value="CODE_128">Code 128 (ตัวเลข/อักษรทั่วไป)</SelectItem>
                          <SelectItem value="QR_CODE">QR Code (2 มิติ)</SelectItem>
                          <SelectItem value="UPC_A">UPC-A (12 หลัก)</SelectItem>
                          <SelectItem value="EAN_8">EAN-8 (8 หลัก)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">สุ่มรหัสมาตรฐานร้าน</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full h-10 text-xs rounded-xl font-semibold gap-1"
                        onClick={() => handleGenerateNewCode(genFormat)}
                      >
                        <Sparkles className="size-3.5 text-primary" /> สุ่มรหัส {genFormat}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">รหัสบาร์โค้ด</Label>
                    <Input
                      value={genCode}
                      onChange={(e) => setGenCode(e.target.value)}
                      className="h-10 font-mono text-xs rounded-xl"
                      placeholder="เช่น 8850124001153"
                    />
                    {inspection && (
                      <p
                        className={`text-[11px] ${inspection.isValid ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {inspection.notes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">ชื่อสินค้าบนป้าย</Label>
                    <Input
                      value={genTitle}
                      onChange={(e) => setGenTitle(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                      placeholder="ชื่อสินค้า เช่น มาม่า ต้มยำกุ้ง"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">ราคาขาย (บาท)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      value={genPrice}
                      onChange={(e) => setGenPrice(parseFloat(e.target.value) || 0)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Preview Card */}
              <Card className="rounded-2xl border-border/80 flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">ตัวอย่างป้ายสินค้า (Label Preview)</CardTitle>
                  <CardDescription className="text-xs">
                    แสดงขนาดและรูปแบบป้ายราคาสำหรับพิมพ์ติดชั้นวางหรือตัวสินค้า
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                  {/* 90s Vintage Style Shelf Label Box */}
                  <div className="w-full max-w-xs border-2 border-primary/40 rounded-xl p-4 bg-amber-50/20 dark:bg-card shadow-xs text-center space-y-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b pb-1">
                      โชห่วยยุค 90s
                    </div>
                    <div className="font-bold text-sm text-foreground line-clamp-1">{genTitle}</div>
                    <div className="bg-white p-2 rounded-lg border flex items-center justify-center">
                      <BarcodeDisplay
                        value={genCode}
                        format={genFormat}
                        showText={true}
                        className="max-h-20"
                      />
                    </div>
                    <div className="pt-1">
                      <span className="text-2xl font-black text-primary">
                        ฿{genPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full max-w-xs pt-2">
                    <Button
                      className="flex-1 rounded-xl h-11 font-bold gap-1.5"
                      onClick={() => window.print()}
                    >
                      <Printer className="size-4" /> พิมพ์ป้ายนี้
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl h-11 px-3"
                      onClick={() => {
                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(genCode);
                          toast.success("คัดลอกรหัสบาร์โค้ดแล้ว");
                        }
                      }}
                      title="คัดลอกรหัส"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Product Registration Modal */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <form onSubmit={handleSaveQuickRegister} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <PackagePlus className="size-5 text-emerald-600" /> ลงทะเบียนสินค้าใหม่ทันที
              </DialogTitle>
              <DialogDescription className="text-xs">
                เพิ่มสินค้าเข้าระบบร้านค้าด้วยรหัสบาร์โค้ดที่เพิ่งสแกน
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">รหัสบาร์โค้ด (Barcode)</Label>
                <Input
                  value={regBarcode}
                  onChange={(e) => setRegBarcode(e.target.value)}
                  className="font-mono text-xs rounded-xl h-10"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  ชื่อสินค้า <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="เช่น บะหมี่กึ่งสำเร็จรูป, ปลากระป๋อง..."
                  className="text-xs rounded-xl h-10"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">ราคาทุน (บาท)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={regCostPrice}
                    onChange={(e) => setRegCostPrice(parseFloat(e.target.value) || 0)}
                    className="text-xs rounded-xl h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    ราคาขาย (บาท) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={regSellPrice}
                    onChange={(e) => setRegSellPrice(parseFloat(e.target.value) || 0)}
                    className="text-xs rounded-xl h-10 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">จำนวนเริ่มต้นในสต็อก</Label>
                  <Input
                    type="number"
                    value={regStock}
                    onChange={(e) => setRegStock(parseInt(e.target.value, 10) || 0)}
                    className="text-xs rounded-xl h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">เตือนสั่งซื้อขั้นต่ำ</Label>
                  <Input
                    type="number"
                    value={regMinStock}
                    onChange={(e) => setRegMinStock(parseInt(e.target.value, 10) || 0)}
                    className="text-xs rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">หมวดหมู่</Label>
                  <Select value={regCategoryId} onValueChange={setRegCategoryId}>
                    <SelectTrigger className="h-9 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">โซนจัดเก็บ</Label>
                  <Select value={regZoneId} onValueChange={setRegZoneId}>
                    <SelectTrigger className="h-9 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id} className="text-xs">
                          {z.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">หน่วยนับ</Label>
                  <Select value={regUnitId} onValueChange={setRegUnitId}>
                    <SelectTrigger className="h-9 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs h-10"
                onClick={() => setRegisterModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="rounded-xl text-xs h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                บันทึกสินค้าใหม่ทันที
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
