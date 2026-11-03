import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Upload,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  RotateCw,
  Eye,
  ArrowRight,
  Package,
  Layers,
  HelpCircle,
  Receipt,
  Building2,
  DollarSign,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Zap,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  expenseService,
  type ExpenseDocType,
  type ExpenseDocument,
  type ExpenseItem,
  type ExpenseCategory,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/lib/expense-service";
import { MasterStore, type ProductItem } from "@/lib/store";
import type { ExtractedReceiptData } from "@/lib/gemini-server";

interface ReceiptOcrModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (doc: ExpenseDocument) => void;
  initialType?: ExpenseDocType;
}

export function ReceiptOcrModal({
  open,
  onClose,
  onSaved,
  initialType = "PURCHASE_GOODS",
}: ReceiptOcrModalProps) {
  // Capture & Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrStep, setOcrStep] = useState<string>("");

  // Camera stream state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraStarting, setIsCameraStarting] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Extracted Data / Editing State
  const [docType, setDocType] = useState<ExpenseDocType>(initialType);
  const [docTypeReason, setDocTypeReason] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [merchantName, setMerchantName] = useState<string>("");
  const [merchantTaxId, setMerchantTaxId] = useState<string>("");
  const [merchantBranch, setMerchantBranch] = useState<string>("");
  const [category, setCategory] = useState<ExpenseCategory>("ซื้อสินค้าเข้าร้าน");
  const [paymentMethod, setPaymentMethod] = useState<ExpenseDocument["paymentMethod"]>("CASH");
  const [paymentStatus, setPaymentStatus] = useState<ExpenseDocument["paymentStatus"]>("PAID");
  const [note, setNote] = useState<string>("");
  const [operator, setOperator] = useState<string>("เจ้าของร้าน");

  // Items State
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [grandTotal, setGrandTotal] = useState<number>(0);

  // Stock options
  const [globalCreditStock, setGlobalCreditStock] = useState<boolean>(true);
  const [globalUpdateCostPrice, setGlobalUpdateCostPrice] = useState<boolean>(false);

  // Duplicate document detection state
  const [duplicateWarning, setDuplicateWarning] = useState<ExpenseDocument | null>(null);

  // Lightbox for original receipt preview
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Products from MasterStore for item matching
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);

  useEffect(() => {
    setAllProducts(MasterStore.getProducts());
  }, []);

  // Check for duplicate whenever docNumber or merchantName changes
  useEffect(() => {
    if (docNumber.trim()) {
      const dup = expenseService.checkDuplicateDoc(docNumber, merchantName);
      if (dup.isDuplicate && dup.existingDoc) {
        setDuplicateWarning(dup.existingDoc);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [docNumber, merchantName]);

  // Recalculate totals from items
  const recalculateFromItems = useCallback((currentItems: ExpenseItem[]) => {
    let sub = 0;
    let disc = 0;
    currentItems.forEach((it) => {
      sub += it.quantity * it.unitPrice;
      disc += it.discount || 0;
    });
    const afterDisc = Math.max(0, sub - disc);
    // default VAT if purchase or company invoice
    const calculatedVat = Math.round(((afterDisc * 7) / 107) * 100) / 100;
    setSubtotal(Math.round(sub * 100) / 100);
    setDiscountTotal(Math.round(disc * 100) / 100);
    setVatAmount(calculatedVat);
    setGrandTotal(Math.round(afterDisc * 100) / 100);
  }, []);

  // Stop camera when closing
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraStarting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
    }
  }, [open, stopCamera]);

  // Callback ref for <video> element to immediately attach active stream when mounted in DOM
  const bindVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
      node.setAttribute("playsinline", "true");
      node.setAttribute("webkit-playsinline", "true");
      node.muted = true;
      node.play().catch((err) => {
        console.warn("Camera video play on attach warning:", err);
      });
    }
  }, []);

  // Extra safeguard effect when isCameraActive changes
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== mediaStreamRef.current) {
        video.srcObject = mediaStreamRef.current;
      }
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.play().catch((err) => {
        console.warn("Camera video play on effect warning:", err);
      });
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    try {
      setIsCameraStarting(true);
      stopCamera();

      if (!navigator?.mediaDevices?.getUserMedia) {
        toast.error("อุปกรณ์นี้ไม่รองรับ WebRTC Camera กรุณาใช้ปุ่ม 'ถ่ายรูปด้วยกล้องมือถือ' แทน");
        setIsCameraStarting(false);
        return;
      }

      let stream: MediaStream;
      try {
        // Preferred: rear environment camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback: any available video device
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setIsCameraStarting(false);
      toast.info("เปิดกล้องสำเร็จ จัดใบเสร็จให้อยู่ในกรอบแล้วกดถ่ายภาพ");
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      setIsCameraActive(false);
      setIsCameraStarting(false);
      const isPermissionDenied =
        err instanceof Error &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      if (isPermissionDenied) {
        toast.error(
          "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์ หรือกด 'ถ่ายภาพด้วยกล้องมือถือ'",
        );
      } else {
        toast.error("ไม่สามารถเปิดกล้องสดได้ กรุณาใช้ปุ่ม 'ถ่ายภาพด้วยกล้องมือถือ' แทน");
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreviewUrl(dataUrl);
    stopCamera();
    toast.success("ถ่ายภาพสำเร็จ กำลังส่งให้ AI วิเคราะห์...");
    void runOcrExtraction(dataUrl, "image/jpeg");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("ขนาดไฟล์ใหญ่เกิน 15MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewUrl(dataUrl);
      void runOcrExtraction(dataUrl, file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  // Run OCR via server endpoint
  const runOcrExtraction = async (base64Url: string, mimeType: string) => {
    setIsProcessing(true);
    setOcrStep("กำลังเชื่อมต่อ AI Gemini Vision...");

    try {
      setOcrStep("Gemini กำลังอ่านข้อความภาษาไทยและแยกประเภทบิล...");

      const response = await fetch("/api/ocr/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Url,
          mimeType: mimeType || "image/jpeg",
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `Server responded with status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || "ไม่สามารถอ่านข้อมูลบิลได้");
      }

      const data: ExtractedReceiptData = result.data;

      // Fill in extracted form values
      setDocType(data.docType);
      setDocTypeReason(data.docTypeReason || "");
      setDocNumber(data.docNumber || `REC-${Date.now().toString().slice(-6)}`);
      setDocDate(data.docDate || new Date().toISOString().slice(0, 10));
      setMerchantName(data.merchantName || "");
      setMerchantTaxId(data.merchantTaxId || "");
      setMerchantBranch(data.merchantBranch || "");

      // Match category
      const matchedCat = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.category === data.expenseCategory,
      );
      if (matchedCat) {
        setCategory(matchedCat.category);
      } else if (data.docType === "PURCHASE_GOODS") {
        setCategory("ซื้อสินค้าเข้าร้าน");
      } else {
        setCategory("ค่าใช้จ่ายทั่วไปอื่นๆ");
      }

      setSubtotal(data.subtotal);
      setDiscountTotal(data.discountTotal);
      setVatAmount(data.vatAmount);
      setGrandTotal(data.grandTotal);

      // Map Items and suggest product matches
      const mappedItems: ExpenseItem[] = data.items.map((it, idx) => {
        const matchedProduct = expenseService.findBestProductMatch(it.name, it.suggestedBarcode);
        return {
          id: `item_${Date.now()}_${idx}`,
          name: it.name,
          quantity: it.quantity || 1,
          unit: it.unit || "ชิ้น",
          unitPrice: it.unitPrice || 0,
          discount: it.discount || 0,
          total: it.total || (it.quantity || 1) * (it.unitPrice || 0),
          matchedProductId: matchedProduct?.id,
          matchedProductName: matchedProduct?.name,
          matchedProductBarcode: matchedProduct?.barcode,
          shouldUpdateStock: Boolean(matchedProduct && data.docType === "PURCHASE_GOODS"),
          shouldUpdateCostPrice: false,
        };
      });

      setItems(mappedItems);

      toast.success(
        data.docType === "PURCHASE_GOODS"
          ? `อ่านบิลซื้อสินค้าสำเร็จ! ตรวจพบ ${mappedItems.length} รายการ (เชื่อมสต็อกได้)`
          : `อ่านบิลค่าใช้จ่ายสำเร็จ (${data.expenseCategory}) - บันทึกเฉพาะรายจ่าย ไม่แตะสต็อก`,
      );
    } catch (err) {
      console.error("OCR Extraction Error:", err);
      toast.error(
        err instanceof Error
          ? `เกิดข้อผิดพลาดในการอ่านบิล: ${err.message}`
          : "เกิดข้อผิดพลาดในการอ่านบิล กรุณากรอกข้อมูลด้วยตนเอง",
      );
      // Fallback empty item row for manual entry
      if (items.length === 0) {
        setItems([
          {
            id: `item_${Date.now()}`,
            name: "รายการจากบิล",
            quantity: 1,
            unit: "ชิ้น",
            unitPrice: 0,
            total: 0,
          },
        ]);
      }
    } finally {
      setIsProcessing(false);
      setOcrStep("");
    }
  };

  // Item row operations
  const handleItemChange = (id: string, updates: Partial<ExpenseItem>) => {
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...updates };
      if (
        updates.quantity !== undefined ||
        updates.unitPrice !== undefined ||
        updates.discount !== undefined
      ) {
        const q = next.quantity || 0;
        const p = next.unitPrice || 0;
        const d = next.discount || 0;
        next.total = Math.max(0, q * p - d);
      }
      return next;
    });
    setItems(updated);
    recalculateFromItems(updated);
  };

  const handleMatchProduct = (itemId: string, productId: string) => {
    const prod = allProducts.find((p) => p.id === productId);
    handleItemChange(itemId, {
      matchedProductId: prod?.id,
      matchedProductName: prod?.name,
      matchedProductBarcode: prod?.barcode,
      shouldUpdateStock: Boolean(prod && docType === "PURCHASE_GOODS"),
    });
    if (prod) {
      toast.info(`จับคู่กับสินค้า "${prod.name}" (สต็อกปัจจุบัน: ${prod.stock} ${prod.sku})`);
    }
  };

  const handleAddItem = () => {
    const newItem: ExpenseItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: "",
      quantity: 1,
      unit: "ชิ้น",
      unitPrice: 0,
      total: 0,
      shouldUpdateStock: docType === "PURCHASE_GOODS",
    };
    const next = [...items, newItem];
    setItems(next);
  };

  const handleRemoveItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    recalculateFromItems(next);
  };

  // Submit / Save Handler
  const handleSave = () => {
    if (!docNumber.trim()) {
      toast.error("กรุณาระบุเลขที่เอกสาร / ใบเสร็จ");
      return;
    }
    if (!merchantName.trim()) {
      toast.error("กรุณาระบุชื่อร้านค้าหรือผู้จำหน่าย");
      return;
    }
    if (items.length === 0) {
      toast.error("กรุณาระบุรายการสินค้าหรือค่าใช้จ่ายอย่างน้อย 1 รายการ");
      return;
    }

    // Duplicate check confirmation
    if (duplicateWarning) {
      const confirmDup = confirm(
        `คำเตือน: พบเอกสารเลขที่ "${docNumber}" จากผู้จำหน่าย "${duplicateWarning.merchantName}" ที่เคยบันทึกไว้แล้วเมื่อ ${duplicateWarning.docDate} (ยอด ฿${duplicateWarning.grandTotal.toLocaleString()})\n\nคุณต้องการบันทึกซ้ำอีกครั้งใช่หรือไม่?`,
      );
      if (!confirmDup) return;
    }

    try {
      const { expense, stockItemsUpdated } = expenseService.createExpense(
        {
          docType,
          docNumber: docNumber.trim(),
          docDate,
          merchantName: merchantName.trim(),
          merchantTaxId: merchantTaxId.trim() || undefined,
          merchantBranch: merchantBranch.trim() || undefined,
          category,
          items,
          subtotal,
          discountTotal,
          vatAmount,
          grandTotal,
          paymentMethod,
          paymentStatus,
          note: note.trim() || undefined,
          originalImageUrl: previewUrl || undefined,
          isStockUpdated: false, // will be updated by createExpense if matched
          operator,
        },
        {
          creditToStock: docType === "PURCHASE_GOODS" && globalCreditStock,
          updateCostPrice: globalUpdateCostPrice,
        },
      );

      if (docType === "PURCHASE_GOODS" && stockItemsUpdated > 0) {
        toast.success(
          `บันทึกบิลซื้อสินค้าเลขที่ ${expense.docNumber} สำเร็จ! และอัปเดตสต็อกสินค้าเข้าคลังแล้ว ${stockItemsUpdated} รายการ`,
        );
      } else {
        toast.success(
          `บันทึกบิลค่าใช้จ่าย ${expense.category} เลขที่ ${expense.docNumber} ยอด ฿${expense.grandTotal.toLocaleString()} สำเร็จ! (ไม่กระทบสต็อก)`,
        );
      }

      onSaved(expense);
      onClose();
    } catch (err) {
      console.error("Save expense error:", err);
      toast.error("เกิดข้อผิดพลาดในการบันทึกเอกสาร");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 rounded-2xl overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-background shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  AI OCR บันทึกบิลซื้อสินค้า & รายจ่ายทั่วไป
                </DialogTitle>
                <DialogDescription className="text-xs">
                  สแกนใบเสร็จ ใบกำกับภาษี และบิลค่าใช้จ่าย ด้วย AI Gemini 3.8 Flash
                  พร้อมแยกบิลซื้อสินค้ากับค่าใช้จ่ายทั่วไป
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* UNIFIED VERTICAL SCROLL BODY: All blocks scroll in the exact same direction */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4 overscroll-contain scroll-smooth">
          {/* TOP SECTION: PHOTO CAPTURE & UPLOAD */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-muted/60 border">
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Native Mobile Camera Direct Input (100% reliable on iOS & Android) */}
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* 2. Photo Library / PDF File Upload Input (No capture) */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Native Mobile Camera Button (Recommended for iPhone / Mobile) */}
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-xl text-xs gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Camera className="size-3.5" /> ถ่ายภาพด้วยกล้องมือถือ
              </Button>

              {/* Live WebRTC Camera Toggle */}
              {isCameraActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-9 rounded-xl text-xs gap-1.5 font-semibold"
                  onClick={stopCamera}
                >
                  <CameraOff className="size-3.5" /> ปิดกล้องสด
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl text-xs gap-1.5 font-semibold bg-background border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                  onClick={startCamera}
                  disabled={isProcessing || isCameraStarting}
                >
                  <ScanLine className="size-3.5 text-sky-600" />{" "}
                  {isCameraStarting ? "กำลังต่อกล้อง..." : "เปิดกล้องสด (Live View)"}
                </Button>
              )}

              {/* Pick from Album / PDF */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs gap-1.5 font-semibold bg-background"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="size-3.5 text-primary" /> เลือกรูปจากอัลบั้ม / PDF
              </Button>

              {previewUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-xl text-xs gap-1 font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => setLightboxOpen(true)}
                >
                  <Eye className="size-3.5" /> ดูภาพต้นฉบับ
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" /> AI Vision พร้อมอ่านบิลจริง
              </span>
            </div>
          </div>

          {/* RECEIPT PREVIEW STRIP (ALIGNED IN SAME VERTICAL FLOW) */}
          {previewUrl && !isCameraActive && (
            <div className="p-3 rounded-2xl border bg-muted/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="size-12 rounded-xl overflow-hidden border bg-background shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                  onClick={() => setLightboxOpen(true)}
                  title="คลิกเพื่อดูภาพขยาย"
                >
                  <img src={previewUrl} alt="Receipt preview" className="size-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>รูปถ่ายใบเสร็จ / บิลต้นฉบับ</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    ระบบประมวลผลข้อมูลลงในฟอร์มด้านล่างแล้ว คลิกภาพเพื่อดูขนาดเต็ม
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs font-semibold shrink-0 gap-1"
                onClick={() => setLightboxOpen(true)}
              >
                <Eye className="size-3" /> ขยายภาพ
              </Button>
            </div>
          )}

          {/* LIVE CAMERA VIEWFINDER (FIXED: Binds active stream to video element immediately) */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/80 bg-black aspect-[4/3] sm:aspect-video max-h-80 flex items-center justify-center shadow-lg">
              <video
                ref={bindVideoRef}
                className="size-full object-cover"
                playsInline
                muted
                autoPlay
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(() => {});
                  }
                }}
              />
              {/* Framing Guide */}
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-emerald-400/80 m-3 sm:m-5 rounded-xl flex flex-col items-center justify-between p-2.5">
                <div className="flex items-center gap-1.5 bg-black/75 text-emerald-300 text-[11px] px-3 py-1 rounded-full backdrop-blur-xs font-medium border border-emerald-500/40 shadow-sm">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  กล้องกำลังทำงาน • จัดใบเสร็จให้อยู่ในกรอบ
                </div>
                <span className="bg-black/60 text-white text-[10px] sm:text-[11px] px-3 py-1 rounded-full backdrop-blur-xs">
                  ถือกล้องให้นิ่งแล้วกดปุ่มถ่ายภาพด้านล่าง
                </span>
              </div>

              {/* Shutter & Cancel Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
                <Button
                  type="button"
                  size="default"
                  className="rounded-full size-14 p-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl ring-4 ring-white/30 font-bold active:scale-95 transition-transform"
                  onClick={capturePhoto}
                  title="กดเพื่อถ่ายภาพใบเสร็จ"
                >
                  <Camera className="size-7" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl h-10 px-4 text-xs font-semibold bg-background/90 hover:bg-background text-foreground shadow-md backdrop-blur-xs"
                  onClick={stopCamera}
                >
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}

          {/* PROCESSING BANNER */}
          {isProcessing && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 text-xs animate-pulse">
              <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <RotateCw className="size-4 animate-spin" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> {ocrStep}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  AI กำลังวิเคราะห์ภาษาไทย แยกชื่อสินค้า ราคา ส่วนลด VAT
                  และจำแนกว่าเป็นบิลซื้อสินค้าหรือค่าใช้จ่ายทั่วไป
                </div>
              </div>
            </div>
          )}

          {/* DUPLICATE DOCUMENT WARNING BANNER */}
          {duplicateWarning && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-1.5">
                  ตรวจพบเลขที่เอกสารซ้ำในระบบ! ({docNumber})
                </div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                  เคยบันทึกเอกสารเลขที่นี้จาก <strong>{duplicateWarning.merchantName}</strong>{" "}
                  ไปแล้วเมื่อวันที่ <strong>{duplicateWarning.docDate}</strong> ยอดสุทธิ{" "}
                  <strong>฿{duplicateWarning.grandTotal.toLocaleString()}</strong> (
                  {duplicateWarning.category})
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  * กรุณาตรวจสอบว่าเป็นบิลซ้ำหรือไม่
                  เพื่อป้องกันการลงบัญชีหรือเพิ่มสต็อกสินค้าซ้ำซ้อน
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT TYPE CLASSIFICATION SELECTOR (NON-NEGOTIABLE RULE) */}
          <div className="rounded-2xl border p-4 space-y-3 bg-card shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" /> ประเภทเอกสาร (Document Type
                  Classification)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  แยกความแตกต่างระหว่างบิลซื้อสินค้ามาขาย (เชื่อมสต็อก) กับค่าใช้จ่ายทั่วไปของร้าน
                  (ไม่เพิ่มสต็อก)
                </p>
              </div>

              {docTypeReason && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-muted/40 max-w-sm truncate text-muted-foreground"
                >
                  AI แนะนำ: {docTypeReason}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: PURCHASE_GOODS */}
              <button
                type="button"
                onClick={() => {
                  setDocType("PURCHASE_GOODS");
                  if (
                    category === "ค่าไฟฟ้า" ||
                    category === "ค่าน้ำประปา" ||
                    category === "ค่าเช่าสถานที่"
                  ) {
                    setCategory("ซื้อสินค้าเข้าร้าน");
                  }
                  setItems((prev) =>
                    prev.map((it) => ({
                      ...it,
                      shouldUpdateStock: Boolean(it.matchedProductId),
                    })),
                  );
                }}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  docType === "PURCHASE_GOODS"
                    ? "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                    🛒 บิลซื้อสินค้าเข้าร้าน (Purchase Bill)
                  </span>
                  {docType === "PURCHASE_GOODS" && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">เลือกอยู่</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  สำหรับซื้อสินค้ามาวางจำหน่ายในร้าน (เช่น ขนม เครื่องดื่ม อาหารแห้ง)
                </p>
                <div className="mt-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> เชื่อมโยงรายจ่าย +
                  นำสินค้าเข้าสต็อกและอัปเดตราคาต้นทุน
                </div>
              </button>

              {/* Option 2: GENERAL_EXPENSE */}
              <button
                type="button"
                onClick={() => {
                  setDocType("GENERAL_EXPENSE");
                  if (category === "ซื้อสินค้าเข้าร้าน") {
                    setCategory("ค่าใช้จ่ายทั่วไปอื่นๆ");
                  }
                  setItems((prev) =>
                    prev.map((it) => ({
                      ...it,
                      shouldUpdateStock: false,
                    })),
                  );
                }}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  docType === "GENERAL_EXPENSE"
                    ? "border-amber-600 bg-amber-500/10 ring-2 ring-amber-500/20"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                    💡 บิลค่าใช้จ่ายทั่วไป (General Expense)
                  </span>
                  {docType === "GENERAL_EXPENSE" && (
                    <Badge className="bg-amber-600 text-white text-[10px]">เลือกอยู่</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ค่าน้ำ, ค่าไฟ, ค่าเช่าร้าน, ค่าโทรศัพท์/เน็ต, ค่าวัสดุสิ้นเปลือง, ค่าจ้าง
                </p>
                <div className="mt-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="size-3" /> บันทึกเฉพาะรายจ่ายร้านค้า —
                  **ไม่เพิ่มสต็อกสินค้า**
                </div>
              </button>
            </div>
          </div>

          {/* MAIN DOCUMENT DETAILS FORM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl border bg-card">
            {/* Doc Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">เลขที่เอกสาร / ใบเสร็จ</Label>
              <Input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="เช่น TAX-6901-0023"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            {/* Doc Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">วันที่เอกสาร</Label>
              <Input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            {/* Merchant Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">ชื่อร้านค้า / ผู้จำหน่าย / ผู้ออกบิล</Label>
              <Input
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="เช่น บจก. สยามแม็คโคร, การไฟฟ้านครหลวง"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Merchant Tax ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                value={merchantTaxId}
                onChange={(e) => setMerchantTaxId(e.target.value)}
                placeholder="เลข 13 หลัก"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            {/* Expense Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">หมวดหมู่รายจ่าย</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as ExpenseCategory)}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_EXPENSE_CATEGORIES.filter((c) =>
                    docType === "PURCHASE_GOODS"
                      ? c.type === "PURCHASE_GOODS"
                      : c.type === "GENERAL_EXPENSE",
                  ).map((c) => (
                    <SelectItem key={c.category} value={c.category}>
                      {c.category}
                    </SelectItem>
                  ))}
                  <SelectItem value="ค่าใช้จ่ายทั่วไปอื่นๆ">ค่าใช้จ่ายทั่วไปอื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">วิธีชำระเงิน</Label>
              <Select
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as ExpenseDocument["paymentMethod"])}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="วิธีชำระ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">เงินสด (Cash)</SelectItem>
                  <SelectItem value="BANK_TRANSFER">โอนเงินธนาคาร</SelectItem>
                  <SelectItem value="PROMPTPAY">สแกนพร้อมเพย์ (PromptPay)</SelectItem>
                  <SelectItem value="CREDIT_CARD">บัตรเครดิต</SelectItem>
                  <SelectItem value="OTHER">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Operator */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ผู้บันทึกเอกสาร</Label>
              <Input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="ชื่อผู้บันทึก"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* GLOBAL STOCK UPDATE CONTROLS (IF PURCHASE_GOODS) */}
          {docType === "PURCHASE_GOODS" && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                  การเชื่อมสต็อกสินค้า:
                </span>
                <span className="text-muted-foreground text-[11px]">
                  เลือกรายการที่จะรับเข้าคลังและปรับปรุงราคาต้นทุน
                </span>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                  <Checkbox
                    checked={globalCreditStock}
                    onCheckedChange={(c) => {
                      const checked = Boolean(c);
                      setGlobalCreditStock(checked);
                      setItems((prev) =>
                        prev.map((it) => ({
                          ...it,
                          shouldUpdateStock: checked && Boolean(it.matchedProductId),
                        })),
                      );
                    }}
                  />
                  <span>เพิ่มสต็อกสินค้าทันที</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                  <Checkbox
                    checked={globalUpdateCostPrice}
                    onCheckedChange={(c) => {
                      const checked = Boolean(c);
                      setGlobalUpdateCostPrice(checked);
                      setItems((prev) =>
                        prev.map((it) => ({
                          ...it,
                          shouldUpdateCostPrice: checked,
                        })),
                      );
                    }}
                  />
                  <span>อัปเดตราคาทุนในระบบ</span>
                </label>
              </div>
            </div>
          )}

          {/* GENERAL EXPENSE NOTICE (IF GENERAL_EXPENSE) */}
          {docType === "GENERAL_EXPENSE" && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 text-amber-600 shrink-0" />
              <span>
                <strong>บิลค่าใช้จ่ายทั่วไป:</strong>{" "}
                รายการด้านล่างจะถูกบันทึกเป็นค่าใช้จ่ายดำเนินงานของร้าน โดยจะ
                <strong>ไม่ถูกนำไปเพิ่มในสต็อกสินค้า</strong>อย่างแน่นอน
              </span>
            </div>
          )}

          {/* ITEMS TABLE */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
            <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground">
                  รายการสินค้า / ค่าใช้จ่ายในบิล ({items.length} รายการ)
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  (สามารถแก้ไขชื่อ จำนวน หรือราคาได้โดยตรง)
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg gap-1 font-semibold"
                onClick={handleAddItem}
              >
                <Plus className="size-3 text-primary" /> เพิ่มแถวรายการ
              </Button>
            </div>

            {/* UNIFIED ITEMS SECTION: Both mobile and desktop scroll in the SAME vertical direction */}
            {items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs p-4">
                ยังไม่มีรายการ กรุณาอัปโหลดรูปภาพบิล หรือกด "+ เพิ่มแถวรายการ" ด้านบน
              </div>
            ) : (
              <>
                {/* 1. MOBILE RESPONSIVE CARDS (No horizontal sliding, strictly vertical scroll) */}
                <div className="md:hidden space-y-3 p-3 bg-muted/10">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border bg-card space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-[11px] font-mono font-bold text-primary shrink-0">
                            #{idx + 1}
                          </span>
                          <Input
                            value={item.name}
                            onChange={(e) => handleItemChange(item.id, { name: e.target.value })}
                            placeholder="ชื่อสินค้า/บริการ"
                            className="h-8 text-xs rounded-lg font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md shrink-0"
                          title="ลบแถวนี้"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      {docType === "PURCHASE_GOODS" && (
                        <div className="space-y-1.5 pt-1 border-t border-border/50">
                          <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <Package className="size-3 text-emerald-600" /> จับคู่สินค้าในร้าน:
                          </label>
                          <select
                            className="w-full h-8 text-xs rounded-lg border bg-background px-2 truncate"
                            value={item.matchedProductId || ""}
                            onChange={(e) => handleMatchProduct(item.id, e.target.value)}
                          >
                            <option value="">-- ไม่จับคู่ (ไม่เพิ่มสต็อก) --</option>
                            {allProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} [{p.barcode}] (สต็อก: {p.stock})
                              </option>
                            ))}
                          </select>
                          {item.matchedProductId && (
                            <div className="flex flex-wrap items-center gap-3 text-[10px] pt-0.5">
                              <label className="flex items-center gap-1 cursor-pointer text-emerald-700 dark:text-emerald-400 font-medium">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.shouldUpdateStock)}
                                  onChange={(e) =>
                                    handleItemChange(item.id, {
                                      shouldUpdateStock: e.target.checked,
                                    })
                                  }
                                  className="size-3"
                                />
                                <span>เพิ่มสต็อก +{item.quantity}</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer text-sky-700 dark:text-sky-400 font-medium">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.shouldUpdateCostPrice)}
                                  onChange={(e) =>
                                    handleItemChange(item.id, {
                                      shouldUpdateCostPrice: e.target.checked,
                                    })
                                  }
                                  className="size-3"
                                />
                                <span>ปรับทุนเป็น ฿{item.unitPrice}</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/50">
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">จำนวน</span>
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(item.id, {
                                quantity: Number(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-xs text-center font-mono rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">หน่วย</span>
                          <Input
                            value={item.unit}
                            onChange={(e) => handleItemChange(item.id, { unit: e.target.value })}
                            placeholder="ชิ้น"
                            className="h-8 text-xs text-center rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">ราคา/หน่วย</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleItemChange(item.id, {
                                unitPrice: Number(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-xs text-right font-mono rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">ส่วนลด</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.discount || 0}
                            onChange={(e) =>
                              handleItemChange(item.id, {
                                discount: Number(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-xs text-right font-mono rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50 font-mono">
                        <span className="text-muted-foreground text-[11px]">ยอดรวมแถวนี้:</span>
                        <span className="font-bold text-foreground">
                          ฿{item.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. DESKTOP VIEW (Fits container cleanly, scrolls in exact same vertical direction) */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-xs text-left table-fixed">
                    <thead className="bg-muted/30 text-muted-foreground font-semibold border-b">
                      <tr>
                        <th className="py-2.5 px-3 w-[26%]">ชื่อรายการ / สินค้า</th>
                        {docType === "PURCHASE_GOODS" ? (
                          <th className="py-2.5 px-2 w-[24%]">จับคู่สินค้าในร้าน</th>
                        ) : null}
                        <th className="py-2.5 px-2 text-center w-[10%]">จำนวน</th>
                        <th className="py-2.5 px-2 text-center w-[8%]">หน่วย</th>
                        <th className="py-2.5 px-2 text-right w-[11%]">ราคา/หน่วย</th>
                        <th className="py-2.5 px-2 text-right w-[9%]">ส่วนลด</th>
                        <th className="py-2.5 px-3 text-right w-[12%]">ยอดรวม</th>
                        <th className="py-2.5 px-2 text-center w-[5%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          {/* Name */}
                          <td className="py-2 px-3">
                            <Input
                              value={item.name}
                              onChange={(e) => handleItemChange(item.id, { name: e.target.value })}
                              placeholder="ชื่อสินค้า/บริการ"
                              className="h-8 text-xs rounded-lg"
                            />
                          </td>

                          {/* Product Matcher (Only if PURCHASE_GOODS) */}
                          {docType === "PURCHASE_GOODS" && (
                            <td className="py-2 px-2">
                              <div className="space-y-1">
                                <select
                                  className="w-full h-8 text-xs rounded-lg border bg-background px-2 truncate"
                                  value={item.matchedProductId || ""}
                                  onChange={(e) => handleMatchProduct(item.id, e.target.value)}
                                >
                                  <option value="">-- ไม่จับคู่ (ไม่เพิ่มสต็อก) --</option>
                                  {allProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} [{p.barcode}] (สต็อก: {p.stock})
                                    </option>
                                  ))}
                                </select>
                                {item.matchedProductId && (
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <label className="flex items-center gap-1 cursor-pointer text-emerald-700 dark:text-emerald-400">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(item.shouldUpdateStock)}
                                        onChange={(e) =>
                                          handleItemChange(item.id, {
                                            shouldUpdateStock: e.target.checked,
                                          })
                                        }
                                        className="size-3"
                                      />
                                      <span>เพิ่มสต็อก +{item.quantity}</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer text-sky-700 dark:text-sky-400">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(item.shouldUpdateCostPrice)}
                                        onChange={(e) =>
                                          handleItemChange(item.id, {
                                            shouldUpdateCostPrice: e.target.checked,
                                          })
                                        }
                                        className="size-3"
                                      />
                                      <span>ปรับทุน</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Quantity */}
                          <td className="py-2 px-2 text-center">
                            <Input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(item.id, {
                                  quantity: Number(e.target.value) || 0,
                                })
                              }
                              className="h-8 text-xs text-center font-mono rounded-lg"
                            />
                          </td>

                          {/* Unit */}
                          <td className="py-2 px-2 text-center">
                            <Input
                              value={item.unit}
                              onChange={(e) => handleItemChange(item.id, { unit: e.target.value })}
                              placeholder="ชิ้น"
                              className="h-8 text-xs text-center rounded-lg"
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="py-2 px-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(item.id, {
                                  unitPrice: Number(e.target.value) || 0,
                                })
                              }
                              className="h-8 text-xs text-right font-mono rounded-lg"
                            />
                          </td>

                          {/* Discount */}
                          <td className="py-2 px-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.discount || 0}
                              onChange={(e) =>
                                handleItemChange(item.id, {
                                  discount: Number(e.target.value) || 0,
                                })
                              }
                              className="h-8 text-xs text-right font-mono rounded-lg"
                            />
                          </td>

                          {/* Total */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground truncate">
                            ฿{item.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Delete Row */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                              title="ลบแถวนี้"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TOTALS FOOTER */}
            <div className="p-4 bg-muted/20 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  รวมรายการสินค้า/ค่าใช้จ่าย: <strong>{items.length}</strong> รายการ
                </div>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                  >
                    <Eye className="size-3" /> เปิดดูรูปถ่ายใบเสร็จต้นฉบับ
                  </button>
                )}
              </div>

              <div className="space-y-1.5 w-full sm:w-64 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>ยอดรวมก่อนภาษี (Subtotal):</span>
                  <span>฿{subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>ส่วนลดรวม (Discount):</span>
                    <span>
                      -฿{discountTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="any"
                      value={vatAmount}
                      onChange={(e) => setVatAmount(Number(e.target.value) || 0)}
                      className="h-6 w-20 text-right text-xs font-mono p-1 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold text-foreground border-t pt-1.5">
                  <span>ยอดรวมสุทธิ (Grand Total):</span>
                  <span className="text-primary font-bold">
                    ฿{grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER - PINNED AT BOTTOM (UNIFIED FLOW) */}
        <DialogFooter className="p-3.5 sm:p-4 border-t bg-muted/30 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {docType === "PURCHASE_GOODS" ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> บิลซื้อสินค้า: ระบบจะบันทึกรายจ่าย
                และเพิ่มสต็อกตามรายการที่จับคู่
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertCircle className="size-3.5" /> บิลค่าใช้จ่ายทั่วไป:
                ระบบจะบันทึกรายจ่ายเท่านั้น ไม่แตะสต็อกสินค้า
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl h-9"
              onClick={onClose}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              className={`rounded-xl h-9 px-4 font-bold shadow-sm ${
                docType === "PURCHASE_GOODS" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
              }`}
              onClick={handleSave}
            >
              {docType === "PURCHASE_GOODS"
                ? "บันทึกบิลซื้อสินค้า & อัปเดตสต็อก"
                : "บันทึกบิลค่าใช้จ่ายทั่วไป"}
            </Button>
          </div>
        </DialogFooter>

        {/* LIGHTBOX FOR ORIGINAL RECEIPT IMAGE */}
        {lightboxOpen && previewUrl && (
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-4 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="size-4 text-primary" /> ภาพเอกสารต้นฉบับ (
                  {docNumber || "ไม่มีเลขที่"})
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-xl overflow-hidden border bg-muted/40 max-h-[75vh] flex items-center justify-center p-2">
                <img
                  src={previewUrl}
                  alt="Original Receipt"
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
                />
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setLightboxOpen(false)}
                >
                  ปิดหน้าต่าง
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
