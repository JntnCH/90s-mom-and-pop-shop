import JsBarcode from "jsbarcode";
import {
  Check,
  CheckSquare,
  Copy,
  Download,
  Filter,
  Layers,
  LayoutGrid,
  Minus,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BarcodeDisplay } from "@/components/barcode/BarcodeDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DEFAULT_LABEL_OPTIONS,
  PrinterService,
  type LabelDesignOptions,
  type LabelItemToPrint,
  type LabelTemplateType,
} from "@/lib/printer-service";
import { DEFAULT_STORE_NAME, getSystemStoreName } from "@/lib/flex-templates";
import {
  MasterStore,
  type CategoryItem,
  type ProductItem,
  type SubCategoryItem,
  type ZoneItem,
} from "@/lib/store";

interface BarcodeLabelSheetProps {
  initialProductId?: string;
}

export function BarcodeLabelSheet({ initialProductId }: BarcodeLabelSheetProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  // Print Queue Items
  const [itemsToPrint, setItemsToPrint] = useState<LabelItemToPrint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter (โซนสินค้า > หมวดหมู่หลัก > หมวดหมู่ย่อย > หน่วยนับ)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedSubCategory, setSelectedSubCategory] = useState("ALL");
  const [selectedUnit, setSelectedUnit] = useState("ALL");

  // Design Options
  const [options, setOptions] = useState<LabelDesignOptions>(DEFAULT_LABEL_OPTIONS);
  const [storeName, setStoreName] = useState(() => getSystemStoreName());

  // Preview Container Ref for Direct Browser Print
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const allProds = MasterStore.getProducts();
    const allZones = MasterStore.getZones();
    const allCats = MasterStore.getCategories();
    const allSubCats = MasterStore.getSubCategories();
    const allUnits = MasterStore.getUnits();

    setProducts(allProds);
    setZones(allZones);
    setCategories(allCats);
    setSubCategories(allSubCats);
    setUnits(allUnits);

    const initialItems: LabelItemToPrint[] = allProds.map((p) => {
      const u = allUnits.find((unit) => unit.id === p.unitId)?.name || "ชิ้น";
      const z = allZones.find((zone) => zone.id === p.zoneId)?.name || "ทั่วไป";
      return {
        productId: p.id,
        name: p.name,
        barcode: p.barcode,
        sku: p.sku || `SKU-${p.id}`,
        price: p.sellPrice,
        unitName: u,
        zoneName: z,
        copies: initialProductId === p.id ? 2 : 1,
      };
    });

    setItemsToPrint(initialItems);

    if (initialProductId) {
      setSelectedIds(new Set([initialProductId]));
    } else {
      // Default select first 4 items for immediate preview
      setSelectedIds(new Set(allProds.slice(0, 4).map((p) => p.id)));
    }
  }, [initialProductId]);

  const filteredItems = useMemo(() => {
    return itemsToPrint.filter((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      if (!p) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.barcode.includes(q);
        const matchSku = item.sku.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchSku) return false;
      }

      if (selectedZone !== "ALL" && p.zoneId !== selectedZone) {
        return false;
      }

      if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) {
        return false;
      }

      if (selectedSubCategory !== "ALL" && p.subCategoryId !== selectedSubCategory) {
        return false;
      }

      if (selectedUnit !== "ALL" && p.unitId !== selectedUnit) {
        return false;
      }

      return true;
    });
  }, [
    itemsToPrint,
    products,
    searchQuery,
    selectedZone,
    selectedCategory,
    selectedSubCategory,
    selectedUnit,
  ]);

  const selectedItemsToPrint = useMemo(() => {
    return itemsToPrint.filter((i) => selectedIds.has(i.productId) && i.copies > 0);
  }, [itemsToPrint, selectedIds]);

  const totalLabelsCount = useMemo(() => {
    return selectedItemsToPrint.reduce((acc, curr) => acc + curr.copies, 0);
  }, [selectedItemsToPrint]);

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.productId)));
    }
  };

  const handleToggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleUpdateCopies = (id: string, delta: number) => {
    setItemsToPrint((prev) =>
      prev.map((i) => {
        if (i.productId === id) {
          const nextVal = Math.max(1, i.copies + delta);
          return { ...i, copies: nextVal };
        }
        return i;
      }),
    );
  };

  const handleSetCopiesByStock = () => {
    setItemsToPrint((prev) =>
      prev.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const stockCount = prod && prod.stock > 0 ? prod.stock : 1;
        return { ...item, copies: stockCount };
      }),
    );
    toast.success("ปรับจำนวนดวงพิมพ์ตามยอดสต็อกคงเหลือเรียบร้อย");
  };

  const handleSetAllCopies = (num: number) => {
    setItemsToPrint((prev) => prev.map((i) => ({ ...i, copies: num })));
    toast.success(`ตั้งจำนวนพิมพ์ ${num} ดวงทุกรายการแล้ว`);
  };

  // Direct Print Call
  const handlePrintLabels = () => {
    if (selectedItemsToPrint.length === 0) {
      toast.error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อพิมพ์");
      return;
    }

    if (!printContainerRef.current) return;
    const html = printContainerRef.current.innerHTML;
    PrinterService.printLabelsDirect(html, options.templateType);

    // Auto-log to Print Spooler / History
    PrinterService.addPrintJob({
      jobTitle: `ป้ายราคา/สติกเกอร์ ${selectedItemsToPrint.length} รายการ (${totalLabelsCount} ดวง)`,
      jobType: options.templateType.startsWith("SHELF_TAG") ? "SHELF_TAG" : "BARCODE_LABEL",
      printerId: "ptr-thermal-58",
      printerName: `เครื่องพิมพ์สติกเกอร์ (${options.templateType})`,
      paperSize: options.templateType,
      copies: totalLabelsCount,
      status: "COMPLETED",
      operator: "พนักงานสต็อก / แคชเชียร์",
      payloadSummary:
        selectedItemsToPrint
          .map((i) => `${i.name} (${i.copies} ดวง)`)
          .slice(0, 3)
          .join(", ") + (selectedItemsToPrint.length > 3 ? "..." : ""),
      rawHtml: html,
    });

    toast.success(`สั่งพิมพ์สติกเกอร์ฉลาก ${totalLabelsCount} ดวงเรียบร้อย`);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Controls */}
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Tag className="size-5 text-primary" /> พิมพ์สติกเกอร์บาร์โค้ด & ป้ายราคาติดชั้นวาง
              (Phase 9)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              รองรับทั้งเครื่องพิมพ์สติกเกอร์ความร้อนม้วนเดี่ยว (Thermal Label 50x30 / 30x20 mm)
              และกระดาษสติกเกอร์ A4
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
              เลือก {selectedIds.size} รายการ (รวม {totalLabelsCount} ดวง)
            </Badge>
            <Button
              className="h-10 text-xs font-semibold rounded-xl gap-2 shadow-sm bg-primary text-primary-foreground active:scale-95"
              onClick={handlePrintLabels}
              disabled={selectedItemsToPrint.length === 0}
            >
              <Printer className="size-4" /> พิมพ์ฉลากทันที ({totalLabelsCount} ดวง)
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT COLUMN: Product Queue & Filter Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CheckSquare className="size-4 text-primary" /> เลือกสินค้าที่ต้องการพิมพ์ฉลาก
                </CardTitle>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] rounded-lg"
                    onClick={handleSetCopiesByStock}
                  >
                    ตั้งตามสต็อก
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] rounded-lg"
                    onClick={() => handleSetAllCopies(1)}
                  >
                    1 ดวง/ชิ้น
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] rounded-lg"
                    onClick={() => handleSetAllCopies(5)}
                  >
                    5 ดวง/ชิ้น
                  </Button>
                </div>
              </div>

              {/* Filters (โซนสินค้า > หมวดหมู่หลัก > หมวดหมู่ย่อย > หน่วยนับ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, บาร์โค้ด, SKU..."
                    className="h-9 pl-8 text-xs rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* 1. โซนสินค้า */}
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="โซน / ชั้นวาง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทุกโซน / ชั้นวาง</SelectItem>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 2. หมวดหมู่หลัก */}
                <Select
                  value={selectedCategory}
                  onValueChange={(val) => {
                    setSelectedCategory(val);
                    setSelectedSubCategory("ALL");
                  }}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="หมวดหมู่หลัก" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทุกหมวดหมู่หลัก</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 3. หมวดหมู่ย่อย */}
                <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="หมวดหมู่ย่อย" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทุกหมวดหมู่ย่อย</SelectItem>
                    {subCategories
                      .filter(
                        (s) =>
                          selectedCategory === "ALL" ||
                          !s.categoryId ||
                          s.categoryId === selectedCategory,
                      )
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* 4. หน่วยนับ */}
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="หน่วยนับ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทุกหน่วยนับ</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-3">
              <div className="rounded-xl border overflow-x-auto max-h-[460px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          checked={
                            selectedIds.size === filteredItems.length && filteredItems.length > 0
                          }
                          onCheckedChange={handleToggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>สินค้า / บาร์โค้ด</TableHead>
                      <TableHead className="text-right w-20">ราคาขาย</TableHead>
                      <TableHead className="text-center w-32">จำนวนดวงที่พิมพ์</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-muted-foreground text-xs"
                        >
                          ไม่พบสินค้าตามเงื่อนไขค้นหา
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => {
                        const isSelected = selectedIds.has(item.productId);
                        return (
                          <TableRow
                            key={item.productId}
                            className={`cursor-pointer ${isSelected ? "bg-primary/5 font-medium" : ""}`}
                            onClick={() => handleToggleItem(item.productId)}
                          >
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleItem(item.productId)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-foreground line-clamp-1">
                                {item.name}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {item.barcode} • {item.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                              ฿{item.price.toFixed(2)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="size-6 rounded-md"
                                  onClick={() => handleUpdateCopies(item.productId, -1)}
                                >
                                  <Minus className="size-3" />
                                </Button>
                                <span className="font-mono text-xs font-bold w-7 text-center">
                                  {item.copies}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="size-6 rounded-md"
                                  onClick={() => handleUpdateCopies(item.productId, 1)}
                                >
                                  <Plus className="size-3" />
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
        </div>

        {/* RIGHT COLUMN: Label Customizer & Realtime Print Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Design Options Card */}
          <Card className="rounded-2xl border-border/80 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Sliders className="size-4 text-primary" /> ตั้งค่าแบบฉลาก (Label Layout)
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {options.templateType}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ขนาดและชนิดสติกเกอร์ *</Label>
              <Select
                value={options.templateType}
                onValueChange={(val: LabelTemplateType) =>
                  setOptions((prev) => ({ ...prev, templateType: val }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHELF_TAG_50x30">
                    🏷️ ป้ายราคาติดชั้นวาง 50x30 mm (Shelf Tag)
                  </SelectItem>
                  <SelectItem value="SHELF_TAG_70x40">
                    🏷️ ป้ายราคาชั้นวางใหญ่ 70x40 mm (Large Shelf Tag)
                  </SelectItem>
                  <SelectItem value="PRODUCT_STICKER_30x20">
                    📦 สติกเกอร์ติดสินค้าดวงเล็ก 30x20 mm
                  </SelectItem>
                  <SelectItem value="PRODUCT_STICKER_40x30">
                    📦 สติกเกอร์ติดสินค้ามาตรฐาน 40x30 mm
                  </SelectItem>
                  <SelectItem value="A4_GRID_3x8">
                    📄 สติกเกอร์แผ่น A4 (3x8 = 24 ดวง/แผ่น)
                  </SelectItem>
                  <SelectItem value="A4_GRID_4x10">
                    📄 สติกเกอร์แผ่น A4 (4x10 = 40 ดวง/แผ่น)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ชื่อร้านค้าบนป้าย</Label>
              <Input
                className="h-8 text-xs rounded-xl"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            {/* Toggle Elements */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
              <div className="flex items-center justify-between py-1">
                <span>ราคาขาย (บาท)</span>
                <Switch
                  checked={options.showPrice}
                  onCheckedChange={(v) => setOptions((p) => ({ ...p, showPrice: v }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span>เส้นบาร์โค้ด</span>
                <Switch
                  checked={options.showBarcode}
                  onCheckedChange={(v) => setOptions((p) => ({ ...p, showBarcode: v }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span>ชื่อร้านค้า</span>
                <Switch
                  checked={options.showStoreName}
                  onCheckedChange={(v) => setOptions((p) => ({ ...p, showStoreName: v }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span>โซน/ชั้นวาง</span>
                <Switch
                  checked={options.showZone}
                  onCheckedChange={(v) => setOptions((p) => ({ ...p, showZone: v }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span>รหัส SKU</span>
                <Switch
                  checked={options.showSku}
                  onCheckedChange={(v) => setOptions((p) => ({ ...p, showSku: v }))}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span>หน่วยนับ</span>
                <Switch
                  checked={options.showUnit}
                  onCheckedChange={(v) => setOptions((p) => ({ ...p, showUnit: v }))}
                />
              </div>
            </div>
          </Card>

          {/* Realtime Print Preview Box */}
          <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/40 p-3 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <Tag className="size-4 text-primary" /> ตัวอย่างฉลากจริง (WYSIWYG Preview)
                </CardTitle>
                <span className="text-[10px] text-muted-foreground">
                  กำลังแสดง {selectedItemsToPrint.length} รายการ
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-3 bg-muted/20 flex flex-col items-center justify-center min-h-[300px]">
              {selectedItemsToPrint.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-10">
                  <Tag className="size-8 mx-auto mb-2 opacity-40" />
                  เลือกสินค้าในตารางด้านซ้ายเพื่อดูตัวอย่างฉลาก
                </div>
              ) : (
                <div
                  ref={printContainerRef}
                  className={`w-full flex flex-wrap gap-2.5 justify-center max-h-[460px] overflow-y-auto p-2 bg-gray-100 rounded-xl border border-gray-300`}
                >
                  {selectedItemsToPrint.map((item) => {
                    return Array.from({ length: item.copies }).map((_, copyIndex) => (
                      <SingleLabelPreviewItem
                        key={`${item.productId}-${copyIndex}`}
                        item={item}
                        options={options}
                        storeName={storeName}
                      />
                    ));
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface SingleLabelPreviewItemProps {
  item: LabelItemToPrint;
  options: LabelDesignOptions;
  storeName: string;
}

function SingleLabelPreviewItem({ item, options, storeName }: SingleLabelPreviewItemProps) {
  const isShelfTag50 = options.templateType === "SHELF_TAG_50x30";
  const isShelfTag70 = options.templateType === "SHELF_TAG_70x40";
  const isSmallSticker = options.templateType === "PRODUCT_STICKER_30x20";
  const isMediumSticker = options.templateType === "PRODUCT_STICKER_40x30";
  const isA4Grid = options.templateType.startsWith("A4_GRID");

  // Determine container dimensions in pixels for preview
  let widthClass = "w-[190px] h-[115px]"; // default 50x30
  if (isShelfTag70) widthClass = "w-[260px] h-[150px]";
  if (isSmallSticker) widthClass = "w-[125px] h-[85px]";
  if (isMediumSticker) widthClass = "w-[160px] h-[120px]";
  if (isA4Grid) widthClass = "w-[180px] h-[110px]";

  return (
    <div
      className={`bg-white text-black p-2 border border-gray-400 rounded-md shadow-sm flex flex-col justify-between overflow-hidden select-none font-sans relative ${widthClass}`}
      style={{ boxSizing: "border-box" }}
    >
      {/* 1. Header (Store Name & SKU/Zone) */}
      <div className="flex items-center justify-between text-[9px] text-gray-600 border-b border-gray-200 pb-0.5">
        {options.showStoreName && (
          <span className="font-bold truncate max-w-[100px]">{storeName}</span>
        )}
        <div className="flex items-center gap-1 font-mono">
          {options.showSku && <span>{item.sku}</span>}
          {options.showZone && item.zoneName && (
            <span className="text-[8px] bg-gray-100 px-1 rounded">{item.zoneName}</span>
          )}
        </div>
      </div>

      {/* 2. Product Name */}
      <div
        className={`font-bold text-gray-900 leading-tight line-clamp-2 my-0.5 ${
          isSmallSticker ? "text-[9px]" : isShelfTag70 ? "text-xs" : "text-[10px]"
        }`}
      >
        {item.name}
      </div>

      {/* 3. Middle / Main Price & Unit */}
      {options.showPrice && (
        <div className="flex items-baseline justify-between my-0.5">
          <div className="flex items-baseline gap-0.5">
            <span
              className={`font-black tracking-tight font-mono text-gray-950 ${
                isSmallSticker
                  ? "text-sm"
                  : isShelfTag70
                    ? "text-2xl font-extrabold"
                    : "text-lg font-bold"
              }`}
            >
              ฿{item.price.toFixed(2)}
            </span>
          </div>
          {options.showUnit && (
            <span className="text-[9px] text-gray-600 font-medium">/{item.unitName}</span>
          )}
        </div>
      )}

      {/* 4. Barcode Render */}
      {options.showBarcode && (
        <div className="flex flex-col items-center justify-center overflow-hidden pt-0.5">
          <BarcodeDisplay
            value={item.barcode}
            format="CODE_128"
            width={isSmallSticker ? 1.0 : isShelfTag70 ? 1.6 : 1.2}
            height={isSmallSticker ? 20 : isShelfTag70 ? 35 : 24}
            fontSize={isSmallSticker ? 8 : 9}
            displayValue={true}
            showActions={false}
            className="p-0 border-0 shadow-none bg-transparent"
          />
        </div>
      )}
    </div>
  );
}
