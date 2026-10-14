import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  Barcode as BarcodeIcon,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Flashlight,
  FlashlightOff,
  Layers,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormatBadge } from "@/components/master/MasterSelects";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { playScanBeep } from "@/lib/scanner-audio";
import type { ScannedCodeType } from "@/lib/scanner-dedup";
import {
  MasterStore,
  type ProductItem,
  type PurchaseOrderRecord,
  type UnitItem,
} from "@/lib/store";

export const Route = createFileRoute("/receive")({
  head: () => ({
    meta: [
      { title: "ตรวจรับสินค้าเข้าสต็อก | MiniMark" },
      {
        name: "description",
        content:
          "ระบบตรวจรับสินค้าเข้าสต็อก ตรวจเช็คเป็นรายไอเทม ตรวจสอบจำนวนที่ได้รับ ส่วนต่างขาด/เกิน และเลือกหน่วยนับ",
      },
      { property: "og:title", content: "ตรวจรับสินค้าเข้าสต็อก | โชห่วยยุค90s" },
      {
        property: "og:description",
        content: "ตรวจรับสินค้าเข้า เช็ครายการ ได้สินค้าจริง ขาดเท่าไหร่ และปรับปรุงสต็อกเรียลไทม์",
      },
    ],
  }),
  component: ReceiveCheckPage,
});

export interface ReceiveCheckItem {
  id: string;
  productId?: string;
  barcode: string;
  productName: string;
  unit: string;
  expectedQuantity: number;
  receivedQuantity: number;
  isReceived: boolean;
  format?: string | undefined;
  codeType?: ScannedCodeType | undefined;
  note?: string;
}

function ReceiveCheckPage() {
  const [activeMode, setActiveMode] = useState<"po_receive" | "scan_receive">("po_receive");
  const [items, setItems] = useState<ReceiveCheckItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>("");

  const [manualCode, setManualCode] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [operatorName, setOperatorName] = useState("พนักงานตรวจรับสินค้า");

  // Add Item Dialog
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSelectedProdId, setAddSelectedProdId] = useState("");
  const [addExpectedQty, setAddExpectedQty] = useState<string>("1");
  const [addReceivedQty, setAddReceivedQty] = useState<string>("1");
  const [addUnit, setAddUnit] = useState("ชิ้น");

  // Real-time synchronization
  const reloadData = useCallback(() => {
    setProducts(MasterStore.getProducts());
    setUnits(MasterStore.getUnits());
    const pos = MasterStore.getPurchaseOrders();
    setPurchaseOrders(pos);
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

  // Load items from PO into checklist
  const handleSelectPO = (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) {
      setItems([]);
      return;
    }
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    const checklist: ReceiveCheckItem[] = po.items.map((it, idx) => ({
      id: `po-item-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: it.productId,
      barcode: it.barcode,
      productName: it.productName,
      unit: it.unitName || "ชิ้น",
      expectedQuantity: it.quantity,
      receivedQuantity: it.quantity, // default to expected, can be edited
      isReceived: true, // checked by default or toggled
      note: "",
    }));

    setItems(checklist);
    toast.success(`โหลดรายการจากใบสั่งซื้อ ${po.orderNumber} สำเร็จ (${checklist.length} รายการ)`);
  };

  // Barcode Detected Handler (Camera or Manual)
  const handleDetectedCode = useCallback(
    (code: string, format?: string, type?: ScannedCodeType) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      playScanBeep();
      const matchedProduct = MasterStore.findByBarcode(trimmed);
      const defaultUnit = matchedProduct
        ? units.find((u) => u.id === matchedProduct.unitId)?.name || "ชิ้น"
        : "ชิ้น";

      setItems((prev) => {
        const existingIdx = prev.findIndex(
          (i) => i.barcode === trimmed || (matchedProduct && i.productId === matchedProduct.id),
        );

        if (existingIdx >= 0) {
          const updated = [...prev];
          const item = updated[existingIdx];
          if (item) {
            updated[existingIdx] = {
              ...item,
              receivedQuantity: item.receivedQuantity + 1,
              isReceived: true, // automatically check as received
            };
          }
          toast.success(`สแกนเพิ่มจำนวน: ${item?.productName || trimmed} (+1)`);
          return updated;
        }

        // New Item in checklist
        const newItem: ReceiveCheckItem = {
          id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ...(matchedProduct ? { productId: matchedProduct.id } : {}),
          barcode: trimmed,
          format: format || matchedProduct?.format,
          codeType: type || (trimmed.toUpperCase().startsWith("QR") ? "QR" : "Barcode"),
          productName: matchedProduct ? matchedProduct.name : `สินค้าใหม่ (${trimmed})`,
          unit: defaultUnit,
          expectedQuantity: matchedProduct ? matchedProduct.minStock || 10 : 1,
          receivedQuantity: 1,
          isReceived: true,
        };

        toast.success(
          matchedProduct
            ? `พบสินค้า: ${matchedProduct.name} [ตรวจรับ 1 ${defaultUnit}]`
            : `สแกนรหัส: ${trimmed} [ตรวจรับ 1 ชิ้น]`,
        );

        return [newItem, ...prev];
      });
    },
    [units],
  );

  const {
    videoRef,
    status: scanStatus,
    error: scanError,
    permissionDenied,
    diagnostics,
    hasTorch,
    isTorchOn,
    toggleTorch,
    start: startScanner,
    stop: stopScanner,
    resetDeduplication,
  } = useBarcodeScanner(handleDetectedCode, { cooldownMs: 900 });

  // Update Item Fields
  const handleToggleReceived = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isReceived: !it.isReceived } : it)),
    );
  };

  const handleUpdateReceivedQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              receivedQuantity: Math.max(0, qty),
              isReceived: qty > 0 ? true : it.isReceived,
            }
          : it,
      ),
    );
  };

  const handleUpdateExpectedQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, expectedQuantity: Math.max(0, qty) } : it)),
    );
  };

  const handleUpdateUnit = (id: string, unitName: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, unit: unitName } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Add Item manually via Dialog
  const handleAddNewItemModal = () => {
    const prod = products.find((p) => p.id === addSelectedProdId) || products[0];
    if (!prod) return;

    const uName = addUnit || units.find((u) => u.id === prod.unitId)?.name || "ชิ้น";
    const parsedExp = addExpectedQty.trim() === "" ? 1 : Number(addExpectedQty);
    const parsedRec = addReceivedQty.trim() === "" ? 0 : Number(addReceivedQty);

    const newItem: ReceiveCheckItem = {
      id: `manual-item-${Date.now()}`,
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      unit: uName,
      expectedQuantity: isNaN(parsedExp) ? 1 : Math.max(0, parsedExp),
      receivedQuantity: isNaN(parsedRec) ? 0 : Math.max(0, parsedRec),
      isReceived: true,
      format: prod.format,
      codeType: prod.codeType,
    };

    setItems((prev) => [newItem, ...prev]);
    toast.success(`เพิ่ม ${prod.name} ในรายการตรวจรับแล้ว`);
    setAddModalOpen(false);
  };

  // Save confirmed received stock
  const handleSaveToStock = () => {
    const verifiedItems = items.filter((it) => it.isReceived && it.receivedQuantity > 0);
    if (verifiedItems.length === 0) {
      toast.error("ไม่มีรายการสินค้าที่ติ๊กได้รับ หรือจำนวนที่ได้รับเป็น 0");
      return;
    }

    const missingCount = items.filter((it) => !it.isReceived || it.receivedQuantity === 0).length;
    const shortCount = items.filter(
      (it) => it.isReceived && it.expectedQuantity > 0 && it.receivedQuantity < it.expectedQuantity,
    ).length;

    verifiedItems.forEach((item) => {
      // 1. Update stock
      MasterStore.receiveStock(
        item.productId || item.barcode,
        item.receivedQuantity,
        operatorName,
        `ตรวจรับสินค้าเข้าสต็อก [${item.receivedQuantity} ${item.unit}] ${
          item.expectedQuantity > 0
            ? `(สั่ง ${item.expectedQuantity} ได้รับ ${item.receivedQuantity}${
                item.receivedQuantity < item.expectedQuantity
                  ? ` ขาด ${item.expectedQuantity - item.receivedQuantity}`
                  : ""
              })`
            : ""
        }`,
      );

      // 2. Add receive log
      MasterStore.addReceive({
        barcode: item.barcode,
        codeType: item.codeType || "Barcode",
        format: item.format,
        productName: item.productName,
        quantity: item.receivedQuantity,
        unit: item.unit,
        scannedAt: new Date().toLocaleString("th-TH"),
      });
    });

    // If receiving against a Purchase Order, update PO status
    if (selectedPoId) {
      const isComplete = missingCount === 0 && shortCount === 0;
      MasterStore.updatePurchaseOrderStatus(selectedPoId, "RECEIVED");
    }

    const totalQty = verifiedItems.reduce((acc, curr) => acc + curr.receivedQuantity, 0);
    setSaveSuccessMsg(
      `บันทึกตรวจรับสินค้าสำเร็จจำนวน ${verifiedItems.length} รายการ (รวม ${totalQty} ชิ้น) ปรับปรุงยอดสต็อกเรียลไทม์เรียบร้อยแล้ว`,
    );
    toast.success("บันทึกรับเข้าสต็อกเรียบร้อยแล้ว!");
    setItems([]);
    setSelectedPoId("");
    setTimeout(() => setSaveSuccessMsg(""), 6000);
  };

  // Summary Metrics
  const totalItemsCount = items.length;
  const receivedItemsCount = items.filter((it) => it.isReceived && it.receivedQuantity > 0).length;
  const missingItemsCount = items.filter(
    (it) => !it.isReceived || it.receivedQuantity === 0,
  ).length;
  const shortItemsCount = items.filter(
    (it) => it.isReceived && it.expectedQuantity > 0 && it.receivedQuantity < it.expectedQuantity,
  ).length;
  const totalReceivedUnits = items.reduce(
    (acc, curr) => acc + (curr.isReceived ? curr.receivedQuantity : 0),
    0,
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      <PageHeader
        title="ตรวจรับสินค้าเข้าสต็อก (Goods Receipt - GRN)"
        description="ตรวจเช็คสินค้าเป็นรายการ ตรวจสอบการได้รับสินค้า จำนวนที่ได้มา ส่วนต่างขาด/เกิน และเลือกหน่วยนับ พร้อมตัดยอดสต็อกเรียลไทม์"
      />

      {saveSuccessMsg ? (
        <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded-2xl">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <AlertTitle className="font-semibold">บันทึกรับเข้าสต็อกสำเร็จ</AlertTitle>
          <AlertDescription className="text-xs">{saveSuccessMsg}</AlertDescription>
        </Alert>
      ) : null}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl p-3 sm:p-4 border shadow-2xs">
          <span className="text-xs text-muted-foreground font-medium block">
            รายการตรวจรับทั้งหมด
          </span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {totalItemsCount}{" "}
            <span className="text-xs text-muted-foreground font-normal">รายการ</span>
          </div>
        </Card>

        <Card className="rounded-2xl p-3 sm:p-4 border shadow-2xs bg-emerald-500/5 border-emerald-500/20">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium block">
            ได้รับสินค้าแล้ว (ติ๊กแล้ว)
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            {receivedItemsCount}{" "}
            <span className="text-xs text-emerald-600 font-normal">รายการ</span>
          </div>
        </Card>

        <Card className="rounded-2xl p-3 sm:p-4 border shadow-2xs bg-destructive/5 border-destructive/20">
          <span className="text-xs text-destructive font-medium block">
            สินค้าที่ขาด / ยังไม่ได้
          </span>
          <div className="text-2xl font-bold font-mono text-destructive mt-1">
            {missingItemsCount + shortItemsCount}{" "}
            <span className="text-xs text-destructive font-normal">รายการ</span>
          </div>
        </Card>

        <Card className="rounded-2xl p-3 sm:p-4 border shadow-2xs bg-primary/5 border-primary/20">
          <span className="text-xs text-primary font-medium block">จำนวนชิ้นที่ได้รับจริง</span>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            {totalReceivedUnits}{" "}
            <span className="text-xs text-muted-foreground font-normal">ชิ้น/หน่วย</span>
          </div>
        </Card>
      </div>

      {/* RECEIVING CONTROLS & CAMERA */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: SCANNER & PO SELECTION */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ScanLine className="size-5 text-primary" /> กล้องสแกนตรวจรับ
                </span>
                <Badge
                  variant={
                    scanStatus === "scanning" || scanStatus === "starting" ? "default" : "outline"
                  }
                  className="text-[11px]"
                >
                  {scanStatus === "scanning" || scanStatus === "starting"
                    ? "กล้องทำงาน"
                    : "กล้องปิด"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Camera Preview */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black border">
                <video
                  ref={videoRef}
                  className="size-full object-cover"
                  muted
                  playsInline
                  aria-label="ภาพจากกล้องสำหรับสแกนสินค้า"
                />
                {scanStatus !== "scanning" && scanStatus !== "starting" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground bg-muted/90">
                    <Camera className="size-9 opacity-50" />
                    <p className="text-xs font-semibold text-foreground">
                      เปิดกล้องเพื่อสแกนสินค้าและเพิ่มจำนวนตรวจรับอัตโนมัติ
                    </p>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-6 flex items-center justify-center">
                    <div className="size-full rounded-2xl border-2 border-primary animate-pulse" />
                  </div>
                )}
              </div>

              {scanError ? (
                <Alert variant="destructive" className="py-2.5 rounded-xl">
                  <AlertCircle className="size-4" />
                  <AlertTitle className="text-xs font-semibold">ข้อผิดพลาดกล้อง</AlertTitle>
                  <AlertDescription className="text-xs">{scanError}</AlertDescription>
                </Alert>
              ) : null}

              {/* Camera Toggle */}
              <div className="flex gap-2">
                {scanStatus === "scanning" || scanStatus === "starting" ? (
                  <>
                    <Button
                      size="default"
                      variant="destructive"
                      className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 active:scale-98"
                      onClick={stopScanner}
                    >
                      <CameraOff className="size-5" /> ปิดกล้องสแกนเนอร์
                    </Button>
                    {hasTorch && (
                      <Button
                        size="default"
                        type="button"
                        variant={isTorchOn ? "default" : "outline"}
                        className="h-12 px-4 rounded-xl font-semibold active:scale-98"
                        onClick={() => void toggleTorch()}
                      >
                        {isTorchOn ? (
                          <FlashlightOff className="size-5" />
                        ) : (
                          <Flashlight className="size-5" />
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="default"
                    className="w-full h-12 rounded-xl font-bold text-sm gap-2 bg-primary text-primary-foreground shadow-sm active:scale-98"
                    onClick={() => void startScanner()}
                  >
                    <Camera className="size-5" /> เปิดกล้องสแกนเนอร์รับสินค้า
                  </Button>
                )}
              </div>

              {/* Manual Barcode Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualCode.trim()) return;
                  handleDetectedCode(manualCode.trim());
                  setManualCode("");
                }}
                className="flex gap-2 pt-1"
              >
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="พิมพ์บาร์โค้ด / สแกนผ่านเครื่อง..."
                  className="h-9 text-xs font-mono rounded-xl"
                />
                <Button type="submit" size="sm" variant="secondary" className="h-9 px-3 rounded-xl">
                  เพิ่ม
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* PO Quick Select Card */}
          <Card className="rounded-2xl border-border/80 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="size-4 text-primary" /> ตรวจรับตามใบสั่งซื้อ (PO)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-primary"
                onClick={reloadData}
              >
                <RefreshCw className="size-3 mr-1" /> รีเฟรช
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                เลือกใบสั่งซื้อที่ต้องการตรวจรับ
              </Label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-xs"
                value={selectedPoId}
                onChange={(e) => handleSelectPO(e.target.value)}
              >
                <option value="">-- ตรวจรับอิสระ (ไม่ผูกใบสั่งซื้อ) --</option>
                {purchaseOrders
                  .filter((p) => p.status === "ORDERED" || p.status === "DRAFT")
                  .map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.orderNumber} ({po.supplierName || "ซัพพลายเออร์"}) • {po.items.length}{" "}
                      รายการ
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5 pt-1 border-t">
              <Label className="text-xs text-muted-foreground">ชื่อผู้ตรวจรับสินค้า</Label>
              <Input
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="h-9 text-xs rounded-xl"
                placeholder="ชื่อพนักงานผู้ตรวจรับ..."
              />
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: RECEIVING CHECKLIST (เช็คเป็นรายการ) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="size-5 text-primary" /> รายการตรวจสอบสินค้าเข้า
                  (Checklist)
                </CardTitle>
                <CardDescription className="text-xs">
                  เช็คการได้รับสินค้า, จำนวนที่ได้มา, คำนวณส่วนต่างขาด/เกิน และเลือกหน่วยนับ
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs rounded-xl gap-1.5"
                  onClick={() => {
                    const firstProd = products[0];
                    if (firstProd) {
                      setAddSelectedProdId(firstProd.id);
                      setAddUnit(units.find((u) => u.id === firstProd.unitId)?.name || "ชิ้น");
                    }
                    setAddModalOpen(true);
                  }}
                >
                  <Plus className="size-3.5" /> เพิ่มรายการตรวจรับเอง
                </Button>

                {items.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
                    onClick={() => {
                      if (confirm("ต้องการล้างรายการตรวจรับทั้งหมดใช่หรือไม่?")) {
                        setItems([]);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1" /> ล้าง
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-3">
                  <PackageCheck className="size-12 mx-auto opacity-30 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">
                      ยังไม่มีรายการสินค้าในรอบตรวจรับนี้
                    </p>
                    <p className="text-xs max-w-sm mx-auto">
                      สแกนบาร์โค้ดผ่านกล้อง, เลือกใบสั่งซื้อจากเมนูด้านซ้าย หรือคลิก "+
                      เพิ่มรายการตรวจรับเอง"
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl text-xs gap-1.5 mt-2"
                    onClick={() => {
                      const firstProd = products[0];
                      if (firstProd) {
                        setAddSelectedProdId(firstProd.id);
                        setAddUnit(units.find((u) => u.id === firstProd.unitId)?.name || "ชิ้น");
                      }
                      setAddModalOpen(true);
                    }}
                  >
                    <Plus className="size-3.5" /> + เพิ่มรายการสินค้าตรวจรับ
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12 text-center">ได้รับไหม</TableHead>
                        <TableHead>สินค้า / บาร์โค้ด</TableHead>
                        <TableHead className="w-32 text-center">หน่วยนับ</TableHead>
                        <TableHead className="w-24 text-right">จำนวนที่สั่ง</TableHead>
                        <TableHead className="w-32 text-center">จำนวนที่ได้มา</TableHead>
                        <TableHead className="w-28 text-center">ขาด/เกิน</TableHead>
                        <TableHead className="w-12 text-center">ลบ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const variance =
                          item.expectedQuantity > 0
                            ? item.receivedQuantity - item.expectedQuantity
                            : 0;
                        const isShort = item.expectedQuantity > 0 && variance < 0;
                        const isOver = item.expectedQuantity > 0 && variance > 0;
                        const isExact = item.expectedQuantity > 0 && variance === 0;

                        return (
                          <TableRow
                            key={item.id}
                            className={`transition-colors ${
                              !item.isReceived ? "opacity-60 bg-muted/20" : ""
                            }`}
                          >
                            {/* 1. เช็คว่าได้สินค้ามาไหม */}
                            <TableCell className="text-center">
                              <Checkbox
                                checked={item.isReceived}
                                onCheckedChange={() => handleToggleReceived(item.id)}
                                aria-label="สถานะได้รับสินค้า"
                                className="size-5 rounded-md"
                              />
                            </TableCell>

                            {/* 2. ชื่อสินค้าและบาร์โค้ด */}
                            <TableCell>
                              <div className="font-semibold text-sm text-foreground">
                                {idx + 1}. {item.productName}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <FormatBadge type={item.codeType} format={item.format} />
                                <span>{item.barcode}</span>
                              </div>
                            </TableCell>

                            {/* 3. เลือกหน่วยนับได้ */}
                            <TableCell className="text-center">
                              <select
                                className="h-9 px-2 text-sm sm:text-base rounded-lg border border-input bg-background font-medium truncate"
                                value={item.unit}
                                onChange={(e) => handleUpdateUnit(item.id, e.target.value)}
                              >
                                {units.map((u) => (
                                  <option key={u.id} value={u.name}>
                                    {u.name} ({u.shortName})
                                  </option>
                                ))}
                                {!units.some((u) => u.name === item.unit) && (
                                  <option value={item.unit}>{item.unit}</option>
                                )}
                              </select>
                            </TableCell>

                            {/* 4. จำนวนที่สั่ง / คาดหวัง */}
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                value={item.expectedQuantity}
                                onChange={(e) =>
                                  handleUpdateExpectedQty(item.id, Number(e.target.value))
                                }
                                className="h-8 w-20 text-right font-mono text-xs rounded-lg inline-block"
                              />
                            </TableCell>

                            {/* 5. จำนวนที่ได้มาจริง */}
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="size-7 rounded-md"
                                  onClick={() =>
                                    handleUpdateReceivedQty(item.id, item.receivedQuantity - 1)
                                  }
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.receivedQuantity}
                                  onChange={(e) =>
                                    handleUpdateReceivedQty(item.id, Number(e.target.value))
                                  }
                                  className="h-8 w-16 text-center font-mono font-bold text-sm rounded-lg"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="size-7 rounded-md"
                                  onClick={() =>
                                    handleUpdateReceivedQty(item.id, item.receivedQuantity + 1)
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>

                            {/* 6. ขาดเท่าไหร่ / ส่วนต่าง */}
                            <TableCell className="text-center font-mono text-xs">
                              {!item.isReceived ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  ยังไม่ได้รับ
                                </Badge>
                              ) : item.expectedQuantity === 0 ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {item.receivedQuantity} {item.unit}
                                </Badge>
                              ) : isShort ? (
                                <Badge variant="destructive" className="text-[10px] font-bold">
                                  ขาด {Math.abs(variance)} {item.unit}
                                </Badge>
                              ) : isOver ? (
                                <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                                  เกิน +{variance} {item.unit}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                  ครบถ้วน
                                </Badge>
                              )}
                            </TableCell>

                            {/* 7. ลบรายการ */}
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Checklist Footer Actions */}
              {items.length > 0 && (
                <div className="p-4 bg-muted/30 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    ตรวจรับแล้ว{" "}
                    <span className="font-bold text-emerald-600 font-mono">
                      {receivedItemsCount} / {items.length}
                    </span>{" "}
                    รายการ • ยอดรับเข้าจริง{" "}
                    <span className="font-bold text-primary font-mono">{totalReceivedUnits}</span>{" "}
                    ชิ้น
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl text-xs flex-1 sm:flex-initial"
                      onClick={() => {
                        setItems((prev) => prev.map((i) => ({ ...i, isReceived: true })));
                        toast.success("ติ๊กได้รับครบทุกรายการแล้ว");
                      }}
                    >
                      <Check className="size-4 mr-1 text-emerald-600" /> ติ๊กได้รับทั้งหมด
                    </Button>

                    <Button
                      size="lg"
                      className="h-11 rounded-xl font-bold gap-2 flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95"
                      onClick={handleSaveToStock}
                    >
                      <PackageCheck className="size-5" /> บันทึกตรวจรับเข้าสต็อก (
                      {totalReceivedUnits} ชิ้น)
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ADD ITEM MODAL */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-[96vw] max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <PackagePlus className="size-5 text-primary" /> เพิ่มรายการตรวจรับเข้า
            </DialogTitle>
            <DialogDescription className="text-xs">
              เลือกสินค้าจากในระบบเพื่อเพิ่มในเช็คลิสต์ตรวจรับ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ค้นหา / เลือกสินค้า *</Label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs shadow-xs"
                value={addSelectedProdId}
                onChange={(e) => {
                  setAddSelectedProdId(e.target.value);
                  const p = products.find((pr) => pr.id === e.target.value);
                  if (p) {
                    setAddUnit(units.find((u) => u.id === p.unitId)?.name || "ชิ้น");
                  }
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.barcode}) • สต็อก: {p.stock}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">จำนวนที่สั่ง/คาดหวัง</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="h-10 rounded-xl font-mono text-center font-bold"
                  value={addExpectedQty}
                  onChange={(e) => setAddExpectedQty(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">จำนวนที่ได้มาจริง</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="h-10 rounded-xl font-mono text-center font-bold text-emerald-600"
                  value={addReceivedQty}
                  onChange={(e) => setAddReceivedQty(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">เลือกหน่วยนับ</Label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base font-medium shadow-xs truncate"
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
                <option value="ชิ้น">ชิ้น</option>
                <option value="กล่อง">กล่อง</option>
                <option value="ลัง">ลัง</option>
                <option value="แพ็ค">แพ็ค</option>
                <option value="ถุง">ถุง</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              className="rounded-xl font-semibold bg-primary text-primary-foreground"
              onClick={handleAddNewItemModal}
            >
              เพิ่มในเช็คลิสต์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
