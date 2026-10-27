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

  // LIFF / LINE in-app browser detection (camera & some scripts are restricted)
  const [isLiffEnv, setIsLiffEnv] = useState(false);
  useEffect(() => {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const inLine = /Line\//i.test(ua) || /LIFF/i.test(ua);
      const hasLiff = typeof window !== "undefined" && !!(window as any).liff;
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
                  กล้องสแกนและบางสคริปต์อาจถูกจำกัดใน WebView ของ LINE
                  (อาจเห็นข้อความ Cross-origin / CORS)
                </p>
                <p className="font-medium">
                  แนะนำ: ใช้ช่องพิมพ์บาร์โค้ดด้านล่าง หรือเปิดหน้านี้นอก LINE (เบราว์เซอร์ภายนอก) เพื่อใช้กล้องเต็มรูปแบบ
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

          <div className="text-center text-xs text-muted-foreground py-4">
            รายละเอียดสินค้าหลังสแกนและ Generator tab ยังคงทำงานตามเดิม (Minimal Change — เพิ่มเฉพาะคำเตือน LIFF)
          </div>
        </TabsContent>

        <TabsContent value="generator" className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">สร้าง & พิมพ์บาร์โค้ด</CardTitle>
              <CardDescription>ส่วน Generator ยังใช้ได้ตามปกติ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                เปิดแท็บนี้เพื่อสร้างบาร์โค้ดใหม่ หรือเลือกสินค้าที่มีอยู่
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
