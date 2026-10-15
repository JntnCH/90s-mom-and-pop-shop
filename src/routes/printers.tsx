import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Bluetooth,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Globe,
  HardDrive,
  Laptop,
  Layers,
  Network,
  Palette,
  Paperclip,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  Usb,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { BarcodeLabelSheet } from "@/components/printer/BarcodeLabelSheet";
import { PrintQueueManager } from "@/components/printer/PrintQueueManager";
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
import { Switch } from "@/components/ui/switch";
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
  DEFAULT_RECEIPT_CONFIG,
  PrinterService,
  type ConnectionType,
  type PrinterDevice,
  type PrinterType,
  type ReceiptDesignConfig,
  type ReceiptPrintData,
} from "@/lib/printer-service";

export const Route = createFileRoute("/printers")({
  head: () => ({
    meta: [
      { title: "จัดการเครื่องพิมพ์, สลิป & คิวพิมพ์ (Phase 10) | โชห่วยยุค90s" },
      {
        name: "description",
        content:
          "ตั้งค่าเครื่องพิมพ์สลิปความร้อน Thermal 58mm / 80mm, A4, สติกเกอร์บาร์โค้ด และระบบจัดการคิวพิมพ์เอกสาร (Print Spooler)",
      },
      {
        property: "og:title",
        content: "จัดการเครื่องพิมพ์, สลิป & คิวพิมพ์ (Phase 10) | โชห่วยยุค90s",
      },
      {
        property: "og:description",
        content: "จัดการเครื่องพิมพ์ความร้อน, สติกเกอร์บาร์โค้ด และคิวงานพิมพ์เอกสาร",
      },
    ],
  }),
  component: PrintersPage,
});

const SAMPLE_RECEIPT_DATA: ReceiptPrintData = {
  receiptNumber: "REC-20260925-0089",
  date: "25/09/2026 14:45 น.",
  cashierName: "แคชเชียร์หน้าร้าน (สมชาย)",
  items: [
    { name: "มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง", quantity: 3, unitPrice: 7.0, total: 21.0 },
    { name: "โค้ก น้ำอัดลม ออริจินัล 325ml", quantity: 2, unitPrice: 15.0, total: 30.0 },
    { name: "เลย์ มันฝรั่งทอด รสคลาสสิค 48g", quantity: 1, unitPrice: 20.0, total: 20.0 },
    { name: "เนสกาแฟ กาแฟปรุงสำเร็จรูป 3in1", quantity: 1, unitPrice: 39.0, total: 39.0 },
  ],
  subtotal: 110.0,
  discount: 0.0,
  vatRate: 0.07,
  vatAmount: 7.2,
  grandTotal: 110.0,
  paidAmount: 200.0,
  changeAmount: 90.0,
  paymentMethod: "CASH",
};

function PrintersPage() {
  const [activeTab, setActiveTab] = useState<
    "devices" | "labels" | "queue" | "designer" | "escpos"
  >("devices");
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptDesignConfig>(DEFAULT_RECEIPT_CONFIG);

  // Add/Edit Printer Modal State
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formType, setFormType] = useState<PrinterType>("THERMAL_58MM");
  const [formConnection, setFormConnection] = useState<ConnectionType>("USB");
  const [formIpAddress, setFormIpAddress] = useState("");
  const [formPort, setFormPort] = useState(9100);

  const loadData = () => {
    setPrinters(PrinterService.getPrinters());
    setReceiptConfig(PrinterService.getReceiptConfig());
  };

  useEffect(() => {
    loadData();
    const onPrintersChange = () => loadData();
    window.addEventListener("minimark_printers_change", onPrintersChange);
    window.addEventListener("minimark_receipt_config_change", onPrintersChange);
    return () => {
      window.removeEventListener("minimark_printers_change", onPrintersChange);
      window.removeEventListener("minimark_receipt_config_change", onPrintersChange);
    };
  }, []);

  const handleOpenAddPrinter = () => {
    setEditingPrinterId(null);
    setFormName("Xprinter XP-58IIH");
    setFormModel("Thermal Receipt 58mm");
    setFormType("THERMAL_58MM");
    setFormConnection("USB");
    setFormIpAddress("");
    setFormPort(9100);
    setPrinterModalOpen(true);
  };

  const handleOpenEditPrinter = (p: PrinterDevice) => {
    setEditingPrinterId(p.id);
    setFormName(p.name);
    setFormModel(p.model);
    setFormType(p.type);
    setFormConnection(p.connection);
    setFormIpAddress(p.ipAddress || "");
    setFormPort(p.port || 9100);
    setPrinterModalOpen(true);
  };

  const handleSavePrinter = () => {
    if (!formName.trim()) {
      toast.error("กรุณาระบุชื่อเครื่องพิมพ์");
      return;
    }

    PrinterService.savePrinter({
      ...(editingPrinterId ? { id: editingPrinterId } : {}),
      name: formName.trim(),
      model: formModel.trim() || formName.trim(),
      type: formType,
      connection: formConnection,
      ...(formIpAddress.trim() ? { ipAddress: formIpAddress.trim() } : {}),
      port: formPort || 9100,
      isDefaultReceipt: editingPrinterId ? false : printers.length === 0,
      isDefaultOrder: false,
      isDefaultLabel: false,
      status: "ONLINE",
    });

    setPrinterModalOpen(false);
    toast.success(editingPrinterId ? "บันทึกเครื่องพิมพ์เรียบร้อย" : "เพิ่มเครื่องพิมพ์ใหม่สำเร็จ");
    loadData();
  };

  const handleDeletePrinter = (id: string, name: string) => {
    if (confirm(`ต้องการลบเครื่องพิมพ์ "${name}" ใช่หรือไม่?`)) {
      PrinterService.deletePrinter(id);
      toast.success("ลบเครื่องพิมพ์เรียบร้อย");
      loadData();
    }
  };

  const handleSetDefault = (id: string, target: "receipt" | "order" | "label") => {
    PrinterService.setDefaultPrinter(id, target);
    toast.success("ตั้งเป็นเครื่องพิมพ์เริ่มต้นเรียบร้อย");
    loadData();
  };

  const handleTestPrint = (printer: PrinterDevice) => {
    PrinterService.updateTestPrintTime(printer.id);
    const paperWidth = printer.type === "THERMAL_80MM" ? "80mm" : "58mm";
    const testHtml = `
      <div style="text-align: center; padding: 10px 0;">
        <h3 style="margin: 0; font-size: 14px;">=== ทดสอบพิมพ์สลิป โชห่วยยุค90s ===</h3>
        <p style="margin: 4px 0; font-size: 11px;">เครื่องพิมพ์: ${printer.name}</p>
        <p style="margin: 2px 0; font-size: 10px;">การเชื่อมต่อ: ${printer.connection}</p>
        <p style="margin: 2px 0; font-size: 10px;">เวลาทดสอบ: ${new Date().toLocaleString("th-TH")}</p>
        <hr style="border: 1px dashed #000; margin: 8px 0;" />
        <p style="margin: 0; font-size: 11px; font-weight: bold;">สถานะ: พร้อมใช้งาน (100% OK)</p>
        <p style="margin: 4px 0; font-size: 9px;">Xprinter / Epson ESC/POS Compatible</p>
      </div>
    `;
    PrinterService.printReceiptDirect(testHtml, paperWidth);
    toast.success(`ส่งคำสั่งพิมพ์ทดสอบไปยัง ${printer.name}`);
    loadData();
  };

  const handleSaveReceiptDesign = () => {
    PrinterService.saveReceiptConfig(receiptConfig);
    toast.success("บันทึกการตั้งค่าเทมเพลตใบเสร็จเรียบร้อยแล้ว");
  };

  const getConnectionIcon = (conn: ConnectionType) => {
    switch (conn) {
      case "USB":
        return <Usb className="size-4 text-blue-500" />;
      case "NETWORK_IP":
        return <Network className="size-4 text-emerald-500" />;
      case "BLUETOOTH":
        return <Bluetooth className="size-4 text-purple-500" />;
      default:
        return <Laptop className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6 pb-12">
      <PageHeader
        title="จัดการเครื่องพิมพ์ & สลิปความร้อน (Phase 8)"
        description="ระบบจัดการเครื่องพิมพ์สลิปความร้อน Thermal 58mm / 80mm, A4 และเครื่องมือออกแบบสลิปใบเสร็จ ESC/POS"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 max-w-3xl h-auto p-1.5 rounded-2xl bg-muted gap-1">
          <TabsTrigger
            value="devices"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <Printer className="size-4" /> เครื่องพิมพ์ ({printers.length})
          </TabsTrigger>
          <TabsTrigger
            value="queue"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <Clock className="size-4 text-primary" /> คิว & ประวัติงานพิมพ์
          </TabsTrigger>
          <TabsTrigger
            value="labels"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <Tag className="size-4 text-primary" /> พิมพ์สติกเกอร์
          </TabsTrigger>
          <TabsTrigger
            value="designer"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <Palette className="size-4 text-primary" /> ออกแบบสลิป
          </TabsTrigger>
          <TabsTrigger
            value="escpos"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <Code2 className="size-4 text-emerald-600" /> ESC/POS
          </TabsTrigger>
        </TabsList>

        {/* TAB: PRINT QUEUE & SPOOLER (PHASE 10) */}
        <TabsContent value="queue" className="space-y-4">
          <PrintQueueManager />
        </TabsContent>

        {/* TAB: LABELS & SHELF TAGS (PHASE 9) */}
        <TabsContent value="labels" className="space-y-4">
          <BarcodeLabelSheet />
        </TabsContent>

        {/* TAB 1: PRINTER DEVICES MANAGEMENT */}
        <TabsContent value="devices" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Printer className="size-5 text-primary" /> เครื่องพิมพ์ทั้งหมดในระบบ โชห่วยยุค90s
                </CardTitle>
                <CardDescription className="text-xs">
                  กำหนดเครื่องพิมพ์เริ่มต้นสำหรับพิมพ์ใบเสร็จรับเงิน, ใบสั่งซื้อสินค้า
                  หรือพิมพ์บาร์โค้ด
                </CardDescription>
              </div>

              <Button
                size="sm"
                className="h-9 text-xs rounded-xl font-semibold gap-1.5 shadow-sm"
                onClick={handleOpenAddPrinter}
              >
                <Plus className="size-4" /> เพิ่มเครื่องพิมพ์ใหม่
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Desktop Printers Table */}
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-56">ชื่อเครื่องพิมพ์ / รุ่น</TableHead>
                      <TableHead className="w-32">ประเภท</TableHead>
                      <TableHead className="w-32">การเชื่อมต่อ</TableHead>
                      <TableHead className="text-center w-36">การใช้งานเริ่มต้น</TableHead>
                      <TableHead className="text-center w-28">สถานะ</TableHead>
                      <TableHead className="text-right w-48">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          ยังไม่มีเครื่องพิมพ์ที่ลงทะเบียนในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      printers.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-semibold text-sm text-foreground">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground">{p.model}</div>
                            {p.lastTestPrintAt && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                ทดสอบล่าสุด: {p.lastTestPrintAt}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {p.type === "THERMAL_58MM"
                                ? "58mm สลิป"
                                : p.type === "THERMAL_80MM"
                                  ? "80mm สลิป"
                                  : p.type === "A4_DOCUMENT"
                                    ? "A4 เอกสาร"
                                    : "Label สติกเกอร์"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              {getConnectionIcon(p.connection)}
                              <span className="font-medium">{p.connection}</span>
                            </div>
                            {p.ipAddress && (
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {p.ipAddress}:{p.port}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col gap-1 items-center">
                              {p.isDefaultReceipt ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">
                                  ✓ สลิปใบเสร็จ
                                </Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={() => handleSetDefault(p.id, "receipt")}
                                >
                                  ตั้งเป็นค่าเริ่มต้น
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              {p.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs rounded-lg gap-1"
                                onClick={() => handleTestPrint(p)}
                              >
                                <Printer className="size-3.5" /> ทดสอบพิมพ์
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs rounded-lg"
                                onClick={() => handleOpenEditPrinter(p)}
                              >
                                แก้ไข
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeletePrinter(p.id, p.name)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: THERMAL SLIP DESIGNER (PHASE 8 CORE) */}
        <TabsContent value="designer" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-12">
            {/* Left Column: Design Controls */}
            <div className="md:col-span-6 space-y-4">
              <Card className="rounded-2xl border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Palette className="size-5 text-primary" /> ออกแบบสลิปใบเสร็จ (Receipt
                      Template)
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {receiptConfig.paperWidth}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    ปรับแต่งข้อมูลร้านค้า, ข้อความต้อนรับ, และองค์ประกอบบนสลิปความร้อน
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">ขนาดหน้ากว้างกระดาษความร้อน *</Label>
                    <Select
                      value={receiptConfig.paperWidth}
                      onValueChange={(val: "58mm" | "80mm") =>
                        setReceiptConfig((prev) => ({ ...prev, paperWidth: val }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">
                          58 mm (สลิปมินิมาร์ทขนาดเล็ก, 32 ตัวอักษร/บรรทัด)
                        </SelectItem>
                        <SelectItem value="80mm">
                          80 mm (สลิปมาตรฐานขนาดใหญ่, 48 ตัวอักษร/บรรทัด)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">ชื่อร้านค้า (Store Name) *</Label>
                    <Input
                      className="h-10 text-xs rounded-xl"
                      value={receiptConfig.storeName}
                      onChange={(e) =>
                        setReceiptConfig((prev) => ({ ...prev, storeName: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">ชื่อสาขา</Label>
                      <Input
                        className="h-10 text-xs rounded-xl"
                        value={receiptConfig.branchName}
                        onChange={(e) =>
                          setReceiptConfig((prev) => ({ ...prev, branchName: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">เลขผู้เสียภาษี</Label>
                      <Input
                        className="h-10 font-mono text-xs rounded-xl"
                        value={receiptConfig.taxId}
                        onChange={(e) =>
                          setReceiptConfig((prev) => ({ ...prev, taxId: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">ที่อยู่ร้านค้า</Label>
                    <Input
                      className="h-10 text-xs rounded-xl"
                      value={receiptConfig.address}
                      onChange={(e) =>
                        setReceiptConfig((prev) => ({ ...prev, address: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">เบอร์โทรศัพท์</Label>
                    <Input
                      className="h-10 text-xs rounded-xl"
                      value={receiptConfig.phone}
                      onChange={(e) =>
                        setReceiptConfig((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">ข้อความหัวสลิป (Header Message)</Label>
                    <Input
                      className="h-10 text-xs rounded-xl"
                      value={receiptConfig.headerMessage}
                      onChange={(e) =>
                        setReceiptConfig((prev) => ({ ...prev, headerMessage: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      ข้อความท้ายสลิป (Footer Message)
                    </Label>
                    <Input
                      className="h-10 text-xs rounded-xl"
                      value={receiptConfig.footerMessage}
                      onChange={(e) =>
                        setReceiptConfig((prev) => ({ ...prev, footerMessage: e.target.value }))
                      }
                    />
                  </div>

                  {/* Switch Controls */}
                  <div className="pt-2 border-t space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-semibold text-foreground">
                          พิมพ์บาร์โค้ดท้ายสลิป (Code 128)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          สำหรับสแกนตรวจสอบการคืนสินค้า
                        </div>
                      </div>
                      <Switch
                        checked={receiptConfig.showBarcode}
                        onCheckedChange={(val) =>
                          setReceiptConfig((prev) => ({ ...prev, showBarcode: val }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-semibold text-foreground">
                          พิมพ์ QR Code พร้อมเพย์รับเงิน
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          สร้าง QR Code สแกนจ่ายอัตโนมัติ
                        </div>
                      </div>
                      <Switch
                        checked={receiptConfig.showPromptPayQR}
                        onCheckedChange={(val) =>
                          setReceiptConfig((prev) => ({ ...prev, showPromptPayQR: val }))
                        }
                      />
                    </div>

                    {receiptConfig.showPromptPayQR && (
                      <div className="space-y-1.5 pl-4 border-l-2 border-primary/30">
                        <Label className="text-xs font-semibold">
                          เบอร์พร้อมเพย์ / เลขบัตรประชาชน
                        </Label>
                        <Input
                          className="h-9 font-mono text-xs rounded-xl"
                          value={receiptConfig.promptPayId}
                          onChange={(e) =>
                            setReceiptConfig((prev) => ({ ...prev, promptPayId: e.target.value }))
                          }
                          placeholder="เช่น 0819876543 หรือ 0105562098765"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-semibold text-foreground">
                          แสดงชื่อพนักงานแคชเชียร์
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          ระบุชื่อผู้ทำรายการขายหน้าร้าน
                        </div>
                      </div>
                      <Switch
                        checked={receiptConfig.showCashierName}
                        onCheckedChange={(val) =>
                          setReceiptConfig((prev) => ({ ...prev, showCashierName: val }))
                        }
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveReceiptDesign}
                    className="w-full h-11 text-xs font-semibold rounded-xl gap-2 shadow-sm"
                  >
                    <Save className="size-4" /> บันทึกการตั้งค่าเทมเพลตใบเสร็จ
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live Thermal Receipt Preview */}
            <div className="md:col-span-6 space-y-4">
              <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/40 pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Printer className="size-5 text-primary" /> ตัวอย่างสลิปความร้อนจริง (Live
                      WYSIWYG)
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {receiptConfig.paperWidth}
                    </Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 flex flex-col items-center justify-center bg-muted/20 min-h-[460px]">
                  <ThermalReceiptPreview
                    config={receiptConfig}
                    data={SAMPLE_RECEIPT_DATA}
                    onPrint={() => toast.success("สั่งพิมพ์สลิปไปยังเครื่องพิมพ์")}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: ESC/POS RAW COMMAND TESTER */}
        <TabsContent value="escpos" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="size-5 text-emerald-600" /> ชุดคำสั่งมาตรฐาน ESC/POS Command Set
              </CardTitle>
              <CardDescription className="text-xs">
                คำสั่งดิบไบนารีสำหรับเครื่องพิมพ์ความร้อน EPSON, Xprinter และเครื่องพิมพ์ POS ทั่วไป
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl bg-black text-emerald-400 p-4 font-mono text-xs space-y-2 overflow-x-auto shadow-inner">
                <div className="text-gray-400">
                  // --- ESC/POS Sequence Generated for โชห่วยยุค90s ---
                </div>
                <div>[ESC @] Initialize printer</div>
                <div>[ESC a 1] Align: CENTER</div>
                <div>[ESC E 1] Bold ON</div>
                <div className="text-white font-bold">{receiptConfig.storeName}</div>
                <div>[ESC E 0] Bold OFF</div>
                <div>{receiptConfig.branchName}</div>
                <div>TAX ID: {receiptConfig.taxId}</div>
                <div>[ESC a 0] Align: LEFT</div>
                <div>REC: {SAMPLE_RECEIPT_DATA.receiptNumber}</div>
                <div>Items total: 4 items (฿110.00)</div>
                <div>[ESC a 2] Align: RIGHT</div>
                <div>TOTAL: ฿110.00</div>
                <div>[GS V 65 0] Cut Paper: FULL CUT</div>
                <div>[ESC B 2 2] Beep: 2 times</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded-xl border bg-muted/40 text-xs space-y-1">
                  <div className="font-bold text-foreground">ESC @ (1B 40)</div>
                  <div className="text-muted-foreground text-[11px]">
                    รีเซ็ตหน่วยความจำและเริ่มการทำงานของหัวพิมพ์
                  </div>
                </div>
                <div className="p-3 rounded-xl border bg-muted/40 text-xs space-y-1">
                  <div className="font-bold text-foreground">GS V 65 (1D 56 41)</div>
                  <div className="text-muted-foreground text-[11px]">
                    สั่งคัทเตอร์ตัดกระดาษอัตโนมัติ (Full / Partial Cut)
                  </div>
                </div>
                <div className="p-3 rounded-xl border bg-muted/40 text-xs space-y-1">
                  <div className="font-bold text-foreground">ESC B (1B 42)</div>
                  <div className="text-muted-foreground text-[11px]">
                    ส่งเสียง Buzzer แจ้งเตือนเมื่อพิมพ์เสร็จ
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADD / EDIT PRINTER MODAL */}
      <Dialog open={printerModalOpen} onOpenChange={setPrinterModalOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              {editingPrinterId ? "แก้ไขเครื่องพิมพ์" : "เพิ่มเครื่องพิมพ์ใหม่"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ตั้งค่าประเภทเครื่องพิมพ์และการเชื่อมต่อ USB, Network LAN/Wi-Fi หรือ Bluetooth
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ชื่อเครื่องพิมพ์ *</Label>
              <Input
                className="h-10 text-xs rounded-xl"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="เช่น Xprinter XP-58IIH (เคาน์เตอร์ 1)"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ประเภทเครื่องพิมพ์ *</Label>
                <Select value={formType} onValueChange={(val) => setFormType(val as PrinterType)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THERMAL_58MM">Thermal 58mm (สลิปเล็ก)</SelectItem>
                    <SelectItem value="THERMAL_80MM">Thermal 80mm (สลิปใหญ่)</SelectItem>
                    <SelectItem value="A4_DOCUMENT">A4 (เอกสาร PO/รายงาน)</SelectItem>
                    <SelectItem value="LABEL_PRINTER">Label (สติกเกอร์บาร์โค้ด)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">การเชื่อมต่อ *</Label>
                <Select
                  value={formConnection}
                  onValueChange={(val) => setFormConnection(val as ConnectionType)}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USB">USB Cable</SelectItem>
                    <SelectItem value="NETWORK_IP">Network IP (LAN/Wi-Fi)</SelectItem>
                    <SelectItem value="BLUETOOTH">Bluetooth</SelectItem>
                    <SelectItem value="SYSTEM_DEFAULT">System Default (OS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formConnection === "NETWORK_IP" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">IP Address</Label>
                  <Input
                    className="h-10 font-mono text-xs rounded-xl"
                    value={formIpAddress}
                    onChange={(e) => setFormIpAddress(e.target.value)}
                    placeholder="192.168.1.188"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Port</Label>
                  <Input
                    type="number"
                    className="h-10 font-mono text-xs rounded-xl"
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-11 rounded-xl w-full sm:w-auto"
              onClick={() => setPrinterModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-11 rounded-xl w-full sm:w-auto font-semibold"
              onClick={handleSavePrinter}
            >
              บันทึกเครื่องพิมพ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
