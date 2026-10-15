import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Barcode as BarcodeIcon,
  Camera,
  CameraOff,
  CheckCircle2,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Flashlight,
  FlashlightOff,
  MinusCircle,
  Package,
  PackageMinus,
  Percent,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
  ScanLine,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DocumentA4Print } from "@/components/documents/DocumentA4Print";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormatBadge } from "@/components/master/MasterSelects";
import { ThermalReceiptPreview } from "@/components/printer/ThermalReceiptPreview";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import {
  DEFAULT_RECEIPT_CONFIG,
  PrinterService,
  type ReceiptPrintData,
} from "@/lib/printer-service";
import {
  calculateDocument,
  DEFAULT_COMPANY_INFO,
  salesDocService,
  type CustomerInfo,
  type DocumentItem,
  type PaymentMethod,
  type SalesDocument,
  type VatType,
} from "@/lib/sales-document-service";
import { playScanBeep } from "@/lib/scanner-audio";
import type { ScannedCodeType } from "@/lib/scanner-dedup";
import { MasterStore, type ProductItem, type UnitItem } from "@/lib/store";
import { thaiBahtText } from "@/lib/thai-baht-text";

export const Route = createFileRoute("/issue")({
  head: () => ({
    meta: [
      { title: "จุดขายหน้าร้าน (POS) & จ่ายสินค้าออก | โชห่วยยุค90s" },
      {
        name: "description",
        content:
          "ขายสินค้าผ่านการสแกนบาร์โค้ด คำนวณภาษีและส่วนลดเหมือน FlowAccount ตัดสต็อกเรียลไทม์ และพิมพ์ใบเสร็จรับเงิน",
      },
      {
        property: "og:title",
        content: "จุดขายหน้าร้าน (POS) & จ่ายสินค้าออก | โชห่วยยุค90s",
      },
      {
        property: "og:description",
        content: "ขายสินค้าผ่านการสแกนบาร์โค้ด สไตล์ FlowAccount พร้อมคำนวณเงินทอนและใบเสร็จ",
      },
    ],
  }),
  component: PosAndIssuePage,
});

interface CartItem {
  id: string;
  productId: string;
  barcode: string;
  name: string;
  stock: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountAmount: number;
}

function PosAndIssuePage() {
  const [activeTab, setActiveTab] = useState<"pos" | "internal_issue">("pos");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [vatType, setVatType] = useState<VatType>("INCLUDED");
  const [vatRate] = useState<number>(7);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState<number>(0);

  // Customer State
  const [customerType, setCustomerType] = useState<"general" | "custom">("general");
  const [customerName, setCustomerName] = useState("ลูกค้าทั่วไป (Cash Customer)");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Checkout Success / Receipt Modal
  const [completedDoc, setCompletedDoc] = useState<SalesDocument | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptViewType, setReceiptViewType] = useState<"thermal" | "a4">("thermal");
  const [promptPayQrUrl, setPromptPayQrUrl] = useState<string>("");

  // Internal Stock Issue State (Tab 2)
  const [internalProdId, setInternalProdId] = useState("");
  const [internalQty, setInternalQty] = useState(1);
  const [internalReason, setInternalReason] = useState("สินค้าเสียหาย / ชำรุด");
  const [internalSuccessMsg, setInternalSuccessMsg] = useState("");

  const reloadData = useCallback(() => {
    const list = MasterStore.getProducts();
    setProducts(list);
    setUnits(MasterStore.getUnits());
    if (list.length > 0 && !internalProdId) {
      setInternalProdId(list[0]?.id || "");
    }
  }, [internalProdId]);

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

  // Add Product to Cart Handler
  const handleAddToCart = useCallback(
    (product: ProductItem, qty: number = 1) => {
      playScanBeep();
      const uName = units.find((u) => u.id === product.unitId)?.name || "ชิ้น";

      setCart((prev) => {
        const existingIdx = prev.findIndex((i) => i.productId === product.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const item = updated[existingIdx];
          if (item) {
            const nextQty = item.quantity + qty;
            if (nextQty > product.stock) {
              toast.warning(`สต็อกสินค้าคงเหลือมีเพียง ${product.stock} ${uName}`);
            }
            updated[existingIdx] = { ...item, quantity: nextQty };
          }
          return updated;
        }

        if (product.stock <= 0) {
          toast.warning(`สินค้า "${product.name}" สต็อกหมดชั่วคราว`);
        }

        return [
          {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: product.id,
            barcode: product.barcode,
            name: product.name,
            stock: product.stock,
            quantity: qty,
            unit: uName,
            unitPrice: product.sellPrice,
            discountAmount: 0,
          },
          ...prev,
        ];
      });

      toast.success(`เพิ่ม: ${product.name} (+${qty})`);
    },
    [units],
  );

  // Barcode Scanned Callback from Camera
  const handleDetectedCode = useCallback(
    (code: string, format?: string, type?: ScannedCodeType) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const matched = MasterStore.findByBarcode(trimmed);
      if (matched) {
        handleAddToCart(matched, 1);
      } else {
        toast.error(`ไม่พบสินค้าสำหรับบาร์โค้ด: ${trimmed}`);
      }
    },
    [handleAddToCart],
  );

  const {
    videoRef,
    status: scanStatus,
    error: scanError,
    permissionDenied,
    hasTorch,
    isTorchOn,
    toggleTorch,
    start: startScanner,
    stop: stopScanner,
  } = useBarcodeScanner(handleDetectedCode, { cooldownMs: 1000 });

  // Update Cart Item
  const handleUpdateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
    } else {
      setCart((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: newQty } : i)),
      );
    }
  };

  const handleUpdateUnitPrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, unitPrice: Math.max(0, price) } : i)),
    );
  };

  const handleUpdateItemDiscount = (productId: string, disc: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, discountAmount: Math.max(0, disc) } : i,
      ),
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // FlowAccount Calculations
  const calculation = useMemo(() => {
    const docItems: DocumentItem[] = cart.map((c) => ({
      id: c.id,
      productId: c.productId,
      barcode: c.barcode,
      name: c.name,
      quantity: c.quantity,
      unit: c.unit,
      unitPrice: c.unitPrice,
      discountAmount: c.discountAmount,
      total: Math.max(0, c.quantity * c.unitPrice - c.discountAmount),
    }));

    return calculateDocument(docItems, vatType, vatRate, overallDiscount, withholdingTaxRate);
  }, [cart, vatType, vatRate, overallDiscount, withholdingTaxRate]);

  // Set default cash received whenever grandTotal changes
  useEffect(() => {
    if (cashReceived === 0 || cashReceived < calculation.grandTotal) {
      setCashReceived(Math.ceil(calculation.grandTotal));
    }
  }, [calculation.grandTotal]);

  // PromptPay QR Code Generation
  useEffect(() => {
    const company = salesDocService.getCompanyInfo();
    const promptPayId = company.promptPayNumber || "0105566012345";
    if (calculation.grandTotal > 0) {
      QRCode.toDataURL(
        `PROMPTPAY:${promptPayId}:${calculation.grandTotal.toFixed(2)}`,
        { width: 180, margin: 1 },
        (err, url) => {
          if (!err && url) setPromptPayQrUrl(url);
        },
      );
    }
  }, [calculation.grandTotal]);

  const changeAmount = Math.max(0, cashReceived - calculation.grandTotal);

  // Complete Sale & Issue Stock (สไตล์ FlowAccount)
  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast.error("ไม่มีสินค้าในตะกร้าขาย");
      return;
    }

    if (paymentMethod === "CASH" && cashReceived < calculation.grandTotal) {
      toast.error("จำนวนเงินสดที่รับมาน้อยกว่ายอดชำระ");
      return;
    }

    const company = salesDocService.getCompanyInfo();
    const now = new Date();
    const issueDate = now.toISOString().slice(0, 10);

    const customer: CustomerInfo = {
      name: customerType === "general" ? "ลูกค้าทั่วไป (Cash Customer)" : customerName.trim(),
      ...(customerType === "custom" && customerTaxId ? { taxId: customerTaxId.trim() } : {}),
      branchType: "HEAD_OFFICE",
      address: customerType === "custom" && customerAddress ? customerAddress.trim() : "หน้าร้าน",
    };

    const docItems: DocumentItem[] = cart.map((c) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: c.productId,
      barcode: c.barcode,
      name: c.name,
      quantity: c.quantity,
      unit: c.unit,
      unitPrice: c.unitPrice,
      discountAmount: c.discountAmount,
      total: Math.max(0, c.quantity * c.unitPrice - c.discountAmount),
    }));

    // Create TAX_INVOICE_RECEIPT document (Auto deducts stock and logs history)
    const newDoc = salesDocService.createDocument({
      type: "TAX_INVOICE_RECEIPT",
      status: "PAID",
      issueDate,
      dueDate: issueDate,
      creditDays: 0,
      customer,
      items: docItems,
      calculation,
      paymentMethod,
      paymentDate: issueDate,
      paymentRef:
        paymentMethod === "CASH"
          ? `รับเงินสด ฿${cashReceived.toFixed(2)} ทอน ฿${changeAmount.toFixed(2)}`
          : "PromptPay/Transfer",
      salesPerson: "แคชเชียร์หน้าร้าน",
      notes: "ขายสินค้าผ่านจุดขาย POS สแกนบาร์โค้ด",
    });

    // Record in Printer Queue
    PrinterService.addPrintJob({
      jobTitle: `ใบเสร็จรับเงิน ${newDoc.docNumber}`,
      jobType: "RECEIPT",
      printerId: "ptr-thermal-58",
      printerName: "เครื่องพิมพ์ความร้อนหน้าร้าน (Thermal 58mm)",
      paperSize: "58mm",
      copies: 1,
      status: "COMPLETED",
      operator: "แคชเชียร์หน้าร้าน",
      payloadSummary: `${docItems.length} รายการ • ยอดสุทธิ ฿${calculation.grandTotal.toFixed(2)}`,
    });

    setCompletedDoc(newDoc);
    setReceiptModalOpen(true);
    setCart([]);
    setOverallDiscount(0);
    toast.success(`ขายสินค้าสำเร็จ! เลขที่ใบเสร็จ: ${newDoc.docNumber}`);
  };

  // Internal Stock Issue (Tab 2)
  const handleConfirmInternalIssue = () => {
    const prod = products.find((p) => p.id === internalProdId);
    if (!prod) return;

    if (internalQty <= 0) {
      toast.error("จำนวนจ่ายออกต้องมากกว่า 0");
      return;
    }

    MasterStore.issueStock(
      prod.id,
      internalQty,
      "เจ้าหน้าที่คลัง/ผู้เบิก",
      `เบิกจ่ายสินค้า: ${internalReason} (${internalQty} ${units.find((u) => u.id === prod.unitId)?.name || "ชิ้น"})`,
    );

    setInternalSuccessMsg(
      `บันทึกจ่าย ${prod.name} จำนวน ${internalQty} ชิ้น เรียบร้อยแล้ว (ตัดสต็อกและบันทึกประวัติทันที)`,
    );
    setTimeout(() => setInternalSuccessMsg(""), 5000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      <PageHeader
        title="จุดขายสินค้า & จ่ายออก (POS Scan-to-Sell)"
        description="สแกนบาร์โค้ดขายสินค้าทันที คำนวณราคารวม ส่วนลด ภาษีมูลค่าเพิ่ม (VAT 7%) เงินทอน และพิมพ์ใบเสร็จ เหมือน FlowAccount พร้อมตัดยอดสต็อกเรียลไทม์"
      />

      {/* Tabs Switcher: POS vs Internal Issue */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-2 max-w-md h-auto p-1.5 rounded-2xl bg-muted gap-1">
          <TabsTrigger
            value="pos"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <ShoppingCart className="size-4 text-emerald-600" /> ขายสินค้าผ่านสแกน (FlowAccount POS)
          </TabsTrigger>
          <TabsTrigger
            value="internal_issue"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <PackageMinus className="size-4 text-destructive" /> เบิกจ่ายภายใน / ตัดสินค้าชำรุด
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: POS SCAN-TO-SELL TERMINAL */}
        <TabsContent value="pos" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* LEFT COLUMN: SCANNER & FAST PRODUCT SELECTOR */}
            <div className="lg:col-span-5 space-y-4">
              {/* Camera Scanner Card */}
              <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b bg-muted/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ScanLine className="size-4 text-primary" /> สแกนบาร์โค้ดเพื่อขายทันที
                  </CardTitle>
                  <Badge
                    variant={
                      scanStatus === "scanning" || scanStatus === "starting" ? "default" : "outline"
                    }
                    className="text-[11px]"
                  >
                    {scanStatus === "scanning" || scanStatus === "starting"
                      ? "กล้องเปิด"
                      : "กล้องปิด"}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Camera Video */}
                  <div className="relative aspect-[4/3] max-h-56 w-full overflow-hidden rounded-xl bg-black border">
                    <video
                      ref={videoRef}
                      className="size-full object-cover"
                      muted
                      playsInline
                      aria-label="ภาพจากกล้องสำหรับสแกนสินค้าเพื่อขาย"
                    />
                    {scanStatus !== "scanning" && scanStatus !== "starting" ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center text-muted-foreground bg-muted/95">
                        <Camera className="size-8 opacity-40 text-primary" />
                        <p className="text-xs font-semibold text-foreground">
                          เปิดกล้อง หรือใช้เครื่องสแกนบาร์โค้ดภายนอก
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          สแกนแล้วจะเพิ่มเข้าบิลและคิดเงินให้อัตโนมัติทันที
                        </p>
                      </div>
                    ) : (
                      <div className="pointer-events-none absolute inset-4 border-2 border-emerald-500 rounded-xl animate-pulse flex items-center justify-center">
                        <div className="w-full h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      </div>
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div className="flex gap-2">
                    {scanStatus === "scanning" || scanStatus === "starting" ? (
                      <>
                        <Button
                          size="default"
                          variant="secondary"
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
                        className="w-full h-12 rounded-xl font-bold text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98"
                        onClick={() => void startScanner()}
                      >
                        <Camera className="size-5" /> เปิดกล้องสแกนเนอร์หน้าร้าน
                      </Button>
                    )}
                  </div>

                  {/* Manual Barcode Search */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!barcodeSearch.trim()) return;
                      handleDetectedCode(barcodeSearch.trim());
                      setBarcodeSearch("");
                    }}
                    className="flex gap-2 pt-1"
                  >
                    <div className="relative flex-1">
                      <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
                      <Input
                        value={barcodeSearch}
                        onChange={(e) => setBarcodeSearch(e.target.value)}
                        placeholder="พิมพ์หรือยิงบาร์โค้ด / รหัส SKU..."
                        className="pl-9 h-9 text-xs font-mono rounded-xl"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      className="h-9 px-4 rounded-xl font-semibold"
                    >
                      ค้นหา
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Quick Touch Products Catalog */}
              <Card className="rounded-2xl border-border/80 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-4 text-primary" /> สินค้ายอดนิยม (แตะเพื่อเพิ่มในบิล)
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {products.filter((p) => p.isActive !== false).length} สินค้า
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {products
                    .filter((p) => p.isActive !== false)
                    .slice(0, 12)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="p-2.5 rounded-xl border bg-card hover:bg-muted/50 text-left transition-all active:scale-95 space-y-1 group"
                        onClick={() => handleAddToCart(p, 1)}
                      >
                        <div className="font-semibold text-xs text-foreground line-clamp-1 group-hover:text-primary">
                          {p.name}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-emerald-600">
                            ฿{p.sellPrice.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground text-[10px]">เหลือ {p.stock}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </Card>
            </div>

            {/* RIGHT COLUMN: FLOWACCOUNT SALES INVOICE & BILLING */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
                {/* Invoice Header */}
                <div className="p-4 bg-muted/40 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Receipt className="size-5 text-emerald-600" />
                      <h2 className="font-bold text-base text-foreground">
                        ใบเสร็จรับเงิน / รายการขาย (Sales Bill)
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      คำนวณราคาแบบ FlowAccount (ส่วนลด, ภาษีมูลค่าเพิ่ม 7%, หัก ณ ที่จ่าย)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {cart.reduce((acc, c) => acc + c.quantity, 0)} ชิ้นในบิล
                    </Badge>
                    {cart.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setCart([])}
                      >
                        <Trash2 className="size-3 mr-1" /> เคลียร์บิล
                      </Button>
                    )}
                  </div>
                </div>

                <CardContent className="p-4 space-y-4">
                  {/* Cart Items Table */}
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground space-y-2">
                      <ShoppingCart className="size-10 mx-auto opacity-30 text-emerald-600" />
                      <p className="font-medium text-sm">ยังไม่มีรายการสินค้าในบิลขาย</p>
                      <p className="text-xs">
                        สแกนบาร์โค้ดผ่านกล้อง หรือแตะเลือกสินค้าจากด้านซ้ายเพื่อเปิดบิล
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/40 text-xs">
                          <TableRow>
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead>สินค้า / บาร์โค้ด</TableHead>
                            <TableHead className="w-28 text-center">จำนวน</TableHead>
                            <TableHead className="w-24 text-right">ราคา/หน่วย</TableHead>
                            <TableHead className="w-24 text-right">ส่วนลด</TableHead>
                            <TableHead className="w-24 text-right">ยอดรวม</TableHead>
                            <TableHead className="w-10 text-center"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {cart.map((item, idx) => {
                            const lineTotal = Math.max(
                              0,
                              item.quantity * item.unitPrice - item.discountAmount,
                            );

                            return (
                              <TableRow key={item.id}>
                                <TableCell className="text-center font-mono text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                <TableCell>
                                  <div className="font-semibold text-foreground">{item.name}</div>
                                  <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                                    <span>{item.barcode}</span>
                                    <span>•</span>
                                    <span
                                      className={
                                        item.stock <= 0
                                          ? "text-destructive font-bold"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      สต็อก: {item.stock} {item.unit}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* Quantity Stepper */}
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="size-6 rounded-md"
                                      onClick={() =>
                                        handleUpdateQty(item.productId, item.quantity - 1)
                                      }
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="1"
                                      className="h-7 w-12 text-center font-mono font-bold text-xs rounded-md"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        handleUpdateQty(item.productId, Number(e.target.value) || 1)
                                      }
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="size-6 rounded-md"
                                      onClick={() =>
                                        handleUpdateQty(item.productId, item.quantity + 1)
                                      }
                                    >
                                      +
                                    </Button>
                                  </div>
                                </TableCell>

                                {/* Unit Price */}
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    step="0.5"
                                    placeholder="0.00"
                                    className="h-7 w-20 text-right font-mono text-xs rounded-md inline-block"
                                    value={item.unitPrice === 0 ? "" : item.unitPrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleUpdateUnitPrice(
                                        item.productId,
                                        val === "" ? 0 : Number(val),
                                      );
                                    }}
                                  />
                                </TableCell>

                                {/* Line Discount */}
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="0"
                                    className="h-7 w-18 text-right font-mono text-xs rounded-md inline-block"
                                    value={
                                      item.discountAmount === 0 ? "" : item.discountAmount || ""
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleUpdateItemDiscount(
                                        item.productId,
                                        val === "" ? 0 : Number(val),
                                      );
                                    }}
                                  />
                                </TableCell>

                                {/* Total */}
                                <TableCell className="text-right font-mono font-bold text-foreground">
                                  ฿{lineTotal.toFixed(2)}
                                </TableCell>

                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemoveFromCart(item.productId)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* BILLING CALCULATIONS (FLOWACCOUNT STYLE) */}
                  <div className="p-4 rounded-2xl bg-muted/40 border space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Overall Discount */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">ส่วนลดท้ายบิล (บาท)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={overallDiscount === 0 ? "" : overallDiscount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOverallDiscount(val === "" ? 0 : Number(val));
                          }}
                          placeholder="0.00"
                          className="h-9 rounded-xl font-mono text-xs"
                        />
                      </div>

                      {/* VAT Option */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">ภาษีมูลค่าเพิ่ม (VAT 7%)</Label>
                        <Select value={vatType} onValueChange={(val) => setVatType(val as VatType)}>
                          <SelectTrigger className="h-9 rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCLUDED">รวมในราคา (VAT Included 7%)</SelectItem>
                            <SelectItem value="EXCLUDED">แยกนอกราคา (VAT Excluded +7%)</SelectItem>
                            <SelectItem value="EXEMPT">ไม่มีภาษี / ได้รับยกเว้น (0%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Withholding Tax */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">หัก ณ ที่จ่าย (WHT)</Label>
                        <Select
                          value={String(withholdingTaxRate)}
                          onValueChange={(val) => setWithholdingTaxRate(Number(val))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">ไม่มีหัก ณ ที่จ่าย (0%)</SelectItem>
                            <SelectItem value="1">ค่าขนส่ง (1%)</SelectItem>
                            <SelectItem value="3">ค่าบริการ / ค่าจ้าง (3%)</SelectItem>
                            <SelectItem value="5">ค่าเช่าทรัพย์สิน (5%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Calculation Summary Table */}
                    <div className="border-t pt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>ยอดรวมก่อนหักส่วนลด (Subtotal):</span>
                        <span className="font-mono">฿{calculation.subtotal.toFixed(2)}</span>
                      </div>

                      {calculation.discountTotal > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>ส่วนลดรวมทั้งสิ้น:</span>
                          <span className="font-mono">
                            -฿{calculation.discountTotal.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-muted-foreground">
                        <span>ยอดหลังหักส่วนลด:</span>
                        <span className="font-mono">฿{calculation.afterDiscount.toFixed(2)}</span>
                      </div>

                      {vatType !== "EXEMPT" && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            ภาษีมูลค่าเพิ่ม VAT 7% ({vatType === "INCLUDED" ? "รวมใน" : "แยกนอก"}):
                          </span>
                          <span className="font-mono">฿{calculation.vatAmount.toFixed(2)}</span>
                        </div>
                      )}

                      {calculation.withholdingTaxAmount > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>ภาษีหัก ณ ที่จ่าย ({withholdingTaxRate}%):</span>
                          <span className="font-mono">
                            -฿{calculation.withholdingTaxAmount.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Grand Total */}
                      <div className="flex justify-between items-baseline pt-2 border-t border-border/80">
                        <div>
                          <span className="font-bold text-base text-foreground">
                            ยอดรวมสุทธิทั้งสิ้น (Grand Total):
                          </span>
                          <div className="text-[11px] text-muted-foreground font-medium italic mt-0.5">
                            ({calculation.thaiBahtText})
                          </div>
                        </div>
                        <span className="text-2xl font-mono font-bold text-emerald-600">
                          ฿
                          {calculation.grandTotal.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CUSTOMER & PAYMENT CONTROLS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Customer Selection */}
                    <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                          <User className="size-3.5 text-primary" /> ข้อมูลผู้ซื้อ / ลูกค้า
                        </Label>
                        <select
                          className="h-7 text-[11px] rounded-lg border border-input bg-background"
                          value={customerType}
                          onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
                        >
                          <option value="general">ลูกค้าทั่วไป (Cash)</option>
                          <option value="custom">ระบุชื่อ / บริษัท</option>
                        </select>
                      </div>

                      {customerType === "custom" && (
                        <div className="space-y-1.5 pt-1">
                          <Input
                            placeholder="ชื่อลูกค้า / บริษัท..."
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                          <Input
                            placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก (ถ้ามี)..."
                            value={customerTaxId}
                            onChange={(e) => setCustomerTaxId(e.target.value)}
                            className="h-8 text-xs font-mono rounded-lg"
                          />
                        </div>
                      )}
                    </div>

                    {/* Payment Method & Cash Change */}
                    <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                      <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                        <Wallet className="size-3.5 text-emerald-600" /> วิธีการชำระเงิน
                      </Label>

                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          type="button"
                          variant={paymentMethod === "CASH" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs rounded-lg font-semibold"
                          onClick={() => setPaymentMethod("CASH")}
                        >
                          💵 เงินสด
                        </Button>
                        <Button
                          type="button"
                          variant={paymentMethod === "PROMPTPAY" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs rounded-lg font-semibold"
                          onClick={() => setPaymentMethod("PROMPTPAY")}
                        >
                          📱 พร้อมเพย์
                        </Button>
                        <Button
                          type="button"
                          variant={paymentMethod === "CREDIT_CARD" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs rounded-lg font-semibold"
                          onClick={() => setPaymentMethod("CREDIT_CARD")}
                        >
                          💳 บัตร/โอน
                        </Button>
                      </div>

                      {paymentMethod === "CASH" && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">
                              รับเงินสดมา (บาท):
                            </span>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0.00"
                              className="h-8 w-28 text-right font-mono font-bold text-sm rounded-lg"
                              value={cashReceived === 0 ? "" : cashReceived}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCashReceived(val === "" ? 0 : Number(val));
                              }}
                            />
                          </div>

                          {/* Quick Cash Presets */}
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            <span className="text-[10px] text-muted-foreground">ลัด:</span>
                            {[Math.ceil(calculation.grandTotal), 50, 100, 500, 1000].map(
                              (amt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="px-1.5 py-0.5 rounded border text-[10px] font-mono hover:bg-muted font-medium"
                                  onClick={() => setCashReceived(amt)}
                                >
                                  {idx === 0 ? "พอดี" : `฿${amt}`}
                                </button>
                              ),
                            )}
                          </div>

                          {/* Change Display */}
                          <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold">
                            <span className="text-emerald-800 dark:text-emerald-200">
                              เงินทอน (Change):
                            </span>
                            <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-300">
                              ฿{changeAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checkout Final Button */}
                  <Button
                    size="lg"
                    disabled={cart.length === 0}
                    className="w-full h-12 rounded-xl text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-98 transition-all"
                    onClick={handleCompleteSale}
                  >
                    <CheckCircle2 className="size-5" /> ชำระเงิน & ออกใบเสร็จ ( ฿
                    {calculation.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })})
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: INTERNAL STOCK ISSUE (เบิกจ่ายสินค้าทั่วไป) */}
        <TabsContent value="internal_issue" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm max-w-2xl mx-auto">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MinusCircle className="size-5 text-destructive" /> เบิกจ่ายสินค้าออกจากสต็อก (Stock
                Issue)
              </CardTitle>
              <CardDescription className="text-xs">
                บันทึกการตัดยอดสต็อกสำหรับการใช้งานภายในร้าน, สินค้าหมดอายุ, ชำรุด หรือสูญหาย
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {internalSuccessMsg && (
                <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded-xl">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <AlertTitle className="text-xs font-semibold">บันทึกสำเร็จ</AlertTitle>
                  <AlertDescription className="text-xs">{internalSuccessMsg}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">เลือกสินค้าที่ต้องการเบิกจ่าย *</Label>
                <select
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs shadow-xs"
                  value={internalProdId}
                  onChange={(e) => setInternalProdId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.barcode}) • คงเหลือ {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">จำนวนที่จ่ายออก *</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-10 rounded-xl font-mono text-center font-bold"
                    value={internalQty}
                    onChange={(e) => setInternalQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">สาเหตุการเบิกจ่าย</Label>
                  <select
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs shadow-xs"
                    value={internalReason}
                    onChange={(e) => setInternalReason(e.target.value)}
                  >
                    <option value="สินค้าเสียหาย / ชำรุด">สินค้าเสียหาย / ชำรุด</option>
                    <option value="สินค้าหมดอายุ (Expired)">สินค้าหมดอายุ (Expired)</option>
                    <option value="เบิกใช้งานภายในร้าน/สำนักงาน">
                      เบิกใช้งานภายในร้าน/สำนักงาน
                    </option>
                    <option value="สินค้าตัวอย่าง/ทดลองชิม">สินค้าตัวอย่าง/ทดลองชิม</option>
                    <option value="สูญหาย/ตรวจนับไม่ตรง">สูญหาย/ตรวจนับไม่ตรง</option>
                  </select>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full h-11 rounded-xl font-semibold gap-2 bg-destructive hover:bg-destructive/90 text-white"
                onClick={handleConfirmInternalIssue}
              >
                <PackageMinus className="size-4" /> ยืนยันตัดยอดสินค้าออกจากสต็อก
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* RECEIPT PREVIEW & PRINT DIALOG */}
      {completedDoc && (
        <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
          <DialogContent className="w-[96vw] max-w-xl rounded-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
            <DialogHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Receipt className="size-5 text-emerald-600" /> ใบเสร็จรับเงินสำเร็จ
                </DialogTitle>
                <Badge className="bg-emerald-600 text-white font-mono text-xs">
                  {completedDoc.docNumber}
                </Badge>
              </div>
              <DialogDescription className="text-xs">
                ตัดยอดสต็อกเรียบร้อยแล้ว สามารถพิมพ์สลิปความร้อน (58mm/80mm)
                หรือพิมพ์เอกสารใบกำกับภาษี A4
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              {/* Receipt View Mode Toggle */}
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant={receiptViewType === "thermal" ? "default" : "outline"}
                  className="rounded-xl text-xs gap-1.5"
                  onClick={() => setReceiptViewType("thermal")}
                >
                  <Printer className="size-3.5" /> สลิปความร้อน (Thermal 58mm)
                </Button>
                <Button
                  size="sm"
                  variant={receiptViewType === "a4" ? "default" : "outline"}
                  className="rounded-xl text-xs gap-1.5"
                  onClick={() => setReceiptViewType("a4")}
                >
                  <FileText className="size-3.5" /> ใบเสร็จ/ใบกำกับภาษี A4
                </Button>
              </div>

              {/* Receipt Body */}
              {receiptViewType === "thermal" ? (
                <div className="bg-muted/40 p-3 rounded-2xl flex justify-center overflow-x-auto">
                  <ThermalReceiptPreview
                    config={{
                      ...DEFAULT_RECEIPT_CONFIG,
                      storeName: DEFAULT_COMPANY_INFO.name,
                      taxId: DEFAULT_COMPANY_INFO.taxId,
                      address: DEFAULT_COMPANY_INFO.address,
                      phone: DEFAULT_COMPANY_INFO.phone,
                      headerMessage: "ยินดีต้อนรับ / ขอบคุณที่ใช้บริการ",
                      footerMessage: "สินค้าซื้อแล้วสามารถเปลี่ยนได้ภายใน 7 วัน",
                      paperWidth: "58mm",
                      showLogo: true,
                      showBarcode: true,
                      showCashierName: true,
                      showPromptPayQR: completedDoc.paymentMethod === "PROMPTPAY",
                      promptPayId: DEFAULT_COMPANY_INFO.promptPayNumber || "0105566012345",
                    }}
                    data={{
                      receiptNumber: completedDoc.docNumber,
                      date: `${completedDoc.issueDate} ${new Date().toLocaleTimeString("th-TH")}`,
                      cashierName: completedDoc.salesPerson || "แคชเชียร์หน้าร้าน",
                      items: completedDoc.items.map((it) => ({
                        name: it.name,
                        quantity: it.quantity,
                        unitPrice: it.unitPrice,
                        total: it.total,
                      })),
                      subtotal: completedDoc.calculation.subtotal,
                      discount: completedDoc.calculation.discountTotal,
                      vatRate: completedDoc.calculation.vatRate / 100,
                      vatAmount: completedDoc.calculation.vatAmount,
                      grandTotal: completedDoc.calculation.grandTotal,
                      paidAmount:
                        completedDoc.paymentMethod === "CASH"
                          ? cashReceived
                          : completedDoc.calculation.grandTotal,
                      changeAmount,
                      paymentMethod:
                        completedDoc.paymentMethod === "CASH"
                          ? "CASH"
                          : completedDoc.paymentMethod === "PROMPTPAY"
                            ? "PROMPTPAY"
                            : "TRANSFER",
                    }}
                  />
                </div>
              ) : (
                <div className="bg-muted/40 p-2 rounded-2xl max-h-[50vh] overflow-y-auto">
                  <DocumentA4Print document={completedDoc} company={DEFAULT_COMPANY_INFO} />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="rounded-xl w-full sm:w-auto"
                onClick={() => setReceiptModalOpen(false)}
              >
                ปิดหน้าต่าง
              </Button>
              <Button
                className="rounded-xl w-full sm:w-auto font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="size-4" /> สั่งพิมพ์ใบเสร็จ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
