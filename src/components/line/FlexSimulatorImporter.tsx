import {
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Layers,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { copyTextToClipboard, downloadJsonFile } from "@/lib/order-export";

import { FlexMessageVisualizer } from "@/components/line/FlexMessageVisualizer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createDailySummaryFlexBubble,
  createFullBleedPurchaseOrderFlexBubble,
  createMiniAppPortalFlexBubble,
  createPurchaseOrderFlexBubble,
  createPurchaseOrderFlexCarousel,
  createStockAlertFlexBubble,
  DEFAULT_STORE_NAME,
  getSystemStoreName,
} from "@/lib/flex-templates";
import {
  FLEX_SIMULATOR_JSON_STORAGE_KEY,
  parseFlexSimulatorJson,
} from "@/lib/flex-templates/flex-simulator-json";
import { shareFlexViaLiffPicker } from "@/lib/line-service";
import { generateFullBleedRichCardSlipImage } from "@/lib/slip-image-generator";

interface FlexSimulatorImporterProps {
  onSaved?: () => void;
}

export function FlexSimulatorImporter({ onSaved }: FlexSimulatorImporterProps) {
  const currentStoreName = getSystemStoreName();

  const [isLargeFont, setIsLargeFont] = useState<boolean>(true);

  const getCustomPOFlex = (large = isLargeFont) =>
    createPurchaseOrderFlexCarousel(
      [
        {
          name: "ปลาร้า แม่เหรียญ ฝาขาว 380 มล.",
          quantity: 1,
          unitName: "แพ็ค",
          categoryName: "เครื่องปรุงรส",
          costPrice: 180,
        },
        {
          name: "ครีมเภสัช 45 ก.",
          quantity: 15,
          unitName: "ขวด",
          categoryName: "ของใช้ส่วนตัว",
          costPrice: 25,
        },
        {
          name: "น้ำปลาทิพรส 700 มล.",
          quantity: 6,
          unitName: "ขวด",
          categoryName: "เครื่องปรุงรส",
          costPrice: 32,
        },
      ],
      {
        storeName: currentStoreName,
        fontSize: large ? "large" : "medium",
        separateQuantityUnit: true,
        includeZone: false,
        groupBy: "category_no_header",
        showGroupHeaders: false,
      },
    );

  const defaultPOFlex = getCustomPOFlex(true);

  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(defaultPOFlex, null, 2));
  const [parsedFlex, setParsedFlex] = useState<unknown>(defaultPOFlex);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isCustomSaved, setIsCustomSaved] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [fullBleedPng, setFullBleedPng] = useState<{ dataUrl: string; blob: Blob } | null>(null);

  useEffect(() => {
    generateFullBleedRichCardSlipImage({
      orderNumber: "PO-2026-001",
      createdAt: "15 ต.ค. 2569 13:45 น.",
      storeName: currentStoreName,
      supplierName: "บริษัท สหพัฒนพิบูล จำกัด (มหาชน)",
      items: [
        {
          name: "ปลาร้า แม่เหรียญ ฝาขาว 380 มล.",
          quantity: 1,
          unitName: "แพ็ค",
          costPrice: 180,
          total: 180,
        },
        {
          name: "ครีมเภสัช 45 ก.",
          quantity: 15,
          unitName: "ขวด",
          costPrice: 25,
          total: 375,
        },
        {
          name: "น้ำปลาทิพรส 700 มล.",
          quantity: 6,
          unitName: "ขวด",
          costPrice: 32,
          total: 192,
        },
      ],
      totalQuantity: 22,
      totalCost: 747,
    })
      .then((res) => setFullBleedPng({ dataUrl: res.dataUrl, blob: res.blob }))
      .catch((err) => console.warn("Failed generating simulator preview PNG:", err));
  }, [currentStoreName]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(FLEX_SIMULATOR_JSON_STORAGE_KEY) || "";
      if (!saved.trim()) {
        const fallback = getCustomPOFlex(true);
        setRawJson(JSON.stringify(fallback, null, 2));
        setParsedFlex(fallback);
        setParseError(null);
        setIsCustomSaved(false);
        return;
      }

      try {
        setRawJson(saved);
        setParsedFlex(parseFlexSimulatorJson(saved));
        setParseError(null);
        setIsCustomSaved(true);
      } catch (error: unknown) {
        const fallback = getCustomPOFlex(true);
        setRawJson(JSON.stringify(fallback, null, 2));
        setParsedFlex(fallback);
        setParseError(error instanceof Error ? error.message : String(error));
        setIsCustomSaved(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJsonChange = (val: string) => {
    setRawJson(val);
    try {
      localStorage.setItem(FLEX_SIMULATOR_JSON_STORAGE_KEY, val);
    } catch (error: unknown) {
      setParsedFlex(null);
      setIsCustomSaved(false);
      setParseError(`ไม่สามารถบันทึก JSON ล่าสุดจากกล่องได้: ${String(error)}`);
      return;
    }

    if (!val.trim()) {
      setParsedFlex(null);
      setIsCustomSaved(false);
      setParseError("กรุณาวาง JSON จาก LINE Flex Simulator");
      return;
    }

    try {
      setParsedFlex(parseFlexSimulatorJson(val));
      setParseError(null);
      setIsCustomSaved(true);
    } catch (err: unknown) {
      setParsedFlex(null);
      setIsCustomSaved(false);
      setParseError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(rawJson);
      handleJsonChange(JSON.stringify(obj, null, 2));
      toast.success("จัดรูปแบบ JSON เรียบร้อย");
    } catch {
      toast.error("ไม่สามารถจัดรูปแบบได้เนื่องจาก JSON มีข้อผิดพลาด");
    }
  };

  const handleSaveActiveTemplate = () => {
    if (parseError || !parsedFlex) {
      toast.error("กรุณาแก้ไขข้อผิดพลาดของ JSON ก่อนบันทึก");
      return;
    }

    try {
      localStorage.setItem(FLEX_SIMULATOR_JSON_STORAGE_KEY, rawJson);
      setIsCustomSaved(true);
      toast.success("ใช้ JSON ล่าสุดจากกล่อง LINE Simulator สำหรับรายการสั่งซื้อแล้ว");
      window.dispatchEvent(new CustomEvent("minimark_store_change"));
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(`เกิดข้อผิดพลาดในการบันทึก: ${String(e)}`);
    }
  };

  const handleResetToDefault = () => {
    if (confirm("ต้องการคืนค่าเป็นแม่แบบมาตรฐานของระบบใช่หรือไม่?")) {
      const freshPO = getCustomPOFlex(true);
      try {
        localStorage.removeItem(FLEX_SIMULATOR_JSON_STORAGE_KEY);
      } catch {
        // ignore
      }
      setRawJson(JSON.stringify(freshPO, null, 2));
      setParsedFlex(freshPO);
      setParseError(null);
      setIsCustomSaved(false);
      setIsLargeFont(true);
      toast.success("คืนค่าแม่แบบมาตรฐาน Carousel 3 คอลัมน์ (รายการสินค้า, จำนวน, หน่วยนับ) เรียบร้อยแล้ว");
      window.dispatchEvent(new CustomEvent("minimark_store_change"));
      if (onSaved) onSaved();
    }
  };

  const handleCopyJson = async () => {
    const success = await copyTextToClipboard(rawJson);
    if (success) {
      setCopied(true);
      toast.success("คัดลอก JSON สำเร็จ นำไปวางที่ LINE Flex Message Simulator ได้ทันที");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("ไม่สามารถคัดลอกได้ กรุณาใช้ปุ่มส่งออก .json เพื่อดาวน์โหลดไฟล์");
    }
  };

  const handleDownloadJson = () => {
    try {
      const obj = rawJson.trim() ? JSON.parse(rawJson) : parsedFlex;
      downloadJsonFile(obj, "po_flex_simulator.json");
      toast.success("ดาวน์โหลดไฟล์ LINE Flex Message (.json) สำเร็จ");
    } catch {
      toast.error("JSON มีข้อผิดพลาด ไม่สามารถส่งออกไฟล์ได้");
    }
  };

  const handleApplyFontConfig = (newLarge: boolean) => {
    setIsLargeFont(newLarge);
    const newPO = getCustomPOFlex(newLarge);
    handleJsonChange(JSON.stringify(newPO, null, 2));
    toast.success(
      `ปรับขนาดตัวอักษรเป็น: ${newLarge ? "ตัวอักษรขนาดใหญ่" : "ตัวอักษรขนาดปกติ"} (3 คอลัมน์: รายการสินค้า, จำนวน, หน่วยนับ) เรียบร้อย`,
    );
  };

  const handleLoadPreset = (presetName: string) => {
    let presetObj: unknown;
    switch (presetName) {
      case "FULL_BLEED_TTB":
        presetObj = createFullBleedPurchaseOrderFlexBubble(
          [
            {
              name: "ปลาร้า แม่เหรียญ ฝาขาว 380 มล.",
              quantity: 1,
              unitName: "แพ็ค",
              categoryName: "เครื่องปรุงรส",
              costPrice: 180,
            },
            {
              name: "ครีมเภสัช 45 ก.",
              quantity: 15,
              unitName: "ขวด",
              categoryName: "ของใช้ส่วนตัว",
              costPrice: 25,
            },
            {
              name: "น้ำปลาทิพรส 700 มล.",
              quantity: 6,
              unitName: "ขวด",
              categoryName: "เครื่องปรุงรส",
              costPrice: 32,
            },
          ],
          {
            storeName: currentStoreName,
          },
        );
        break;
      case "PO":
        presetObj = getCustomPOFlex(isLargeFont);
        break;
      case "ALERT":
        presetObj = createStockAlertFlexBubble(
          [
            {
              name: "ปลาร้า แม่เหรียญ ฝาขาว",
              stock: 0,
              minStock: 5,
              unitName: "แพ็ค",
              status: "OUT_OF_STOCK",
            },
            {
              name: "ครีมเภสัช 45 ก.",
              stock: 2,
              minStock: 10,
              unitName: "ขวด",
              status: "LOW_STOCK",
            },
            {
              name: "น้ำปลาทิพรส 700 มล.",
              stock: 1,
              minStock: 8,
              unitName: "ขวด",
              status: "LOW_STOCK",
            },
          ],
          {
            storeName: currentStoreName,
            fontSize: isLargeFont ? "large" : "medium",
            separateQuantityUnit: true,
          },
        );
        break;
      case "PORTAL":
        presetObj = createMiniAppPortalFlexBubble({
          storeName: currentStoreName,
          liffId: "2011710264-gaZ7oEcK",
        });
        break;
      case "SUMMARY":
        presetObj = createDailySummaryFlexBubble(
          {
            totalProducts: 24,
            inStockCount: 18,
            lowStockCount: 4,
            outOfStockCount: 2,
            totalEstimatedCost: 4500,
            reorderCount: 6,
          },
          { storeName: currentStoreName },
        );
        break;
    }

    if (presetObj) {
      handleJsonChange(JSON.stringify(presetObj, null, 2));
      toast.success(`โหลดตัวอย่างแม่แบบ "${presetName}" เรียบร้อย`);
    }
  };

  const handleTestSendToLine = async () => {
    if (parseError || !parsedFlex) {
      toast.error("JSON มีข้อผิดพลาด ไม่สามารถส่งได้");
      return;
    }

    setIsTesting(true);
    try {
      const res = await shareFlexViaLiffPicker(
        parsedFlex,
        `ทดสอบส่ง Flex Message จาก${currentStoreName}`,
      );
      if (res.success) {
        toast.success("ส่ง LINE Flex Message เข้าห้องแชทสำเร็จเรียบร้อย");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(`ส่งไม่สำเร็จ: ${String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-w-0 w-full space-y-4">
      {/* Top Banner & Instructions */}
      <div className="rounded-2xl border bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#06C755] text-white shadow-xs">
                <Sparkles className="size-4" />
              </span>
              <h3 className="font-bold text-base text-foreground">
                เครื่องมือนำเข้า & ปรับแต่ง Flex Message JSON จาก LINE Simulator
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              แม่แบบใหม่: แยกคอลัมน์ <strong>[รายการสินค้า] [จำนวน] [หน่วยนับ]</strong>{" "}
              ออกจากกันอย่างชัดเจน พร้อมปรับตัวหนังสือขนาดใหญ่พิเศษ (Size: md, lg, xl)
              อ่านง่ายสบายตาบนมือถือ
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="h-9 text-xs rounded-xl gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
              คัดลอก JSON ไปวางที่ LINE Simulator
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="h-9 text-xs rounded-xl gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <Download className="size-3.5" />
              ส่งออกไฟล์ JSON (.json)
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 text-xs rounded-xl gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
            >
              <a
                href="https://developers.line.biz/flex-simulator/"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-3.5" /> เปิด LINE Flex Simulator
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      {isCustomSaved ? (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 rounded-2xl">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold">
            ใช้ JSON ล่าสุดจากกล่อง LINE Simulator แล้ว
          </AlertTitle>
          <AlertDescription className="text-xs">
            ใช้ JSON นี้เป็นโครงสร้างและสไตล์ของ Flex Message
            ส่วนรายการ/จำนวน/ยอดเงินอ่านจากใบสั่งซื้อจริง ณ ตอน preview หรือส่งออก
          </AlertDescription>
        </Alert>
      ) : null}

      {parseError ? (
        <Alert className="bg-destructive/10 border-destructive/30 text-destructive rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-semibold">ข้อผิดพลาดใน JSON</AlertTitle>
          <AlertDescription className="text-xs font-mono">{parseError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Quick Layout & Font Customizer Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/50 p-3 rounded-2xl border border-border/70">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> ปรับแต่งเลย์เอาต์ด่วน:
          </span>

          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            ✓ 3 คอลัมน์ (รายการสินค้า, จำนวน, หน่วยนับ)
          </span>

          <Button
            size="sm"
            variant={isLargeFont ? "default" : "outline"}
            className={`h-7 text-xs rounded-lg px-2.5 gap-1 ${
              isLargeFont ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
            }`}
            onClick={() => handleApplyFontConfig(!isLargeFont)}
          >
            {isLargeFont ? "✓ ฟอนต์ใหญ่ (Large Font)" : "ฟอนต์ปกติ (Regular)"}
          </Button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-[11px] font-semibold text-muted-foreground mr-1">โหลดแม่แบบ:</div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5 font-bold border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-50/60 dark:bg-orange-950/20 shadow-xs gap-1"
            onClick={() => handleLoadPreset("FULL_BLEED_TTB")}
          >
            🌟 เต็มจอ (แบบตัวอย่าง ttb)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5 font-medium"
            onClick={() => handleLoadPreset("PO")}
          >
            📦 ใบสั่งซื้อ (PO)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5 font-medium"
            onClick={() => handleLoadPreset("ALERT")}
          >
            ⚠️ เตือนสต็อก
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5 font-medium"
            onClick={() => handleLoadPreset("PORTAL")}
          >
            🏪 ทางเข้า Mini App
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5 font-medium"
            onClick={() => handleLoadPreset("SUMMARY")}
          >
            📊 สรุปยอด
          </Button>
        </div>
      </div>

      {/* 3 Steps Guide for LINE Simulator */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-950 dark:text-amber-200 space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          💡 วิธีใช้งานร่วมกับ LINE Flex Message Simulator:
        </p>
        <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-amber-900/90 dark:text-amber-200/90">
          <li>
            กดปุ่ม <strong>&quot;คัดลอก JSON&quot;</strong> จากช่องด้านซ้าย
          </li>
          <li>
            เปิดเว็บ <strong>LINE Flex Message Simulator</strong> แล้วคลิกปุ่ม{" "}
            <strong>&lt;Show JSON&gt;</strong> ที่แถบขวาบน
          </li>
          <li>
            ลบโค้ดเดิมใน Simulator แล้ววาง JSON ที่คัดลอกไป จากนั้นกด <strong>Apply</strong>{" "}
            เพื่อดูหรือปรับแต่งเพิ่มเติม
          </li>
          <li>
            เมื่อปรับแต่งเสร็จ คัดลอก JSON จาก Simulator กลับมาวางในกล่องนี้ ระบบจะบันทึก JSON
            ล่าสุดและใช้กับรายการสั่งซื้อทันที
          </li>
        </ol>
        <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
          ข้อมูลสินค้าและยอดเงินจริงจะถูกเติมตอน preview/ส่งออก Flex โดยคงโครงสร้างเดิมไว้
          หากต้องการกำหนดตำแหน่งเอง ให้ใส่ token ในค่า text ของ JSON เช่น{" "}
          <code>{"{{productName}}"}</code>, <code>{"{{quantity}}"}</code>,{" "}
          <code>{"{{unitName}}"}</code> ในกล่องแถวสินค้า (ระบบทำซ้ำแถวนั้นตามรายการจริง) และใช้{" "}
          <code>{"{{categoryName}}"}</code> กับ <code>{"{{itemCount}}"}</code>{" "}
          ในแถวหัวหมวดหมู่เพื่อสร้างหัวกลุ่มจริง และใช้ <code>{"{{orderNumber}}"}</code>,{" "}
          <code>{"{{supplierName}}"}</code>, <code>{"{{totalQuantity}}"}</code>,{" "}
          <code>{"{{totalCost}}"}</code> สำหรับข้อมูลใบสั่งซื้อ
          ระบบยังเติมแถวสินค้าตัวอย่างมาตรฐานที่ตรวจพบได้อัตโนมัติด้วย
        </p>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column: JSON Input Textarea */}
        <Card className="min-w-0 w-full rounded-2xl border shadow-xs flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Code2 className="size-4 text-primary" />
                <CardTitle className="text-sm">กล่องวาง JSON (LINE Simulator)</CardTitle>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 gap-1"
                  onClick={handleFormatJson}
                >
                  <RefreshCw className="size-3" /> จัดหน้า
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 gap-1 font-semibold text-emerald-700 dark:text-emerald-300"
                  onClick={handleCopyJson}
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? "คัดลอกแล้ว!" : "คัดลอก JSON"}
                </Button>
              </div>
            </div>
            <CardDescription className="text-[11px]">
              วาง JSON แบบ <code>{"{ type: 'bubble', ... }"}</code> หรือแบบเต็ม{" "}
              <code>{"{ type: 'flex', contents: { ... } }"}</code>
            </CardDescription>
          </CardHeader>

          <CardContent className="min-w-0 p-4 space-y-3 flex-1 flex flex-col">
            <Textarea
              value={rawJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder="วาง JSON ที่คัดลอกจาก LINE Flex Message Simulator ที่นี่..."
              className="min-w-0 w-full max-w-full font-mono text-xs h-[420px] rounded-xl bg-muted/20 resize-none border-border/80 focus-visible:ring-primary leading-relaxed"
              spellCheck={false}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetToDefault}
                className="h-9 text-xs rounded-xl text-muted-foreground gap-1 hover:text-destructive"
              >
                <Trash2 className="size-3.5" /> คืนค่ามาตรฐาน
              </Button>

              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadJson}
                  disabled={Boolean(parseError)}
                  className="h-9 text-xs rounded-xl font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1.5"
                >
                  <Download className="size-3.5" />
                  ส่งออก .json
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestSendToLine}
                  disabled={Boolean(parseError) || isTesting}
                  className="h-9 text-xs rounded-xl font-semibold text-[#06C755] border-[#06C755]/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1.5"
                >
                  <Send className="size-3.5" />
                  {isTesting ? "กำลังส่ง..." : "ทดสอบส่งเข้า LINE"}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveActiveTemplate}
                  disabled={Boolean(parseError)}
                  className="h-9 text-xs rounded-xl font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Save className="size-3.5" /> บันทึกเป็นแม่แบบใช้งาน
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Live Visual Preview */}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 text-xs font-bold text-foreground flex items-center gap-1.5">
              <MessageCircle className="size-4 text-[#06C755]" /> ตัวอย่างผลลัพธ์ในแอป LINE (Live
              Preview)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              >
                แยกจำนวน/หน่วยนับ • ฟอนต์ใหญ่
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                อัปเดตสด
              </Badge>
            </div>
          </div>

          <FlexMessageVisualizer
            flexData={parsedFlex}
            title="ตัวอย่างการแสดงผล Flex Message & ภาพเต็มจอ"
            className="min-w-0 w-full rounded-2xl"
            imageUrl={fullBleedPng?.dataUrl}
            imageBlob={fullBleedPng?.blob}
            storeName={currentStoreName}
          />
        </div>
      </div>
    </div>
  );
}
