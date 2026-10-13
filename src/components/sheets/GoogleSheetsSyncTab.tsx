import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  buildProductExportRows,
  createNewSpreadsheet,
  getGoogleAccessToken,
  getSpreadsheetMetadata,
  initGoogleAuth,
  listUserSpreadsheets,
  readSpreadsheetValues,
  signInWithGoogle,
  signOutFromGoogle,
  updateSpreadsheetRange,
  type DriveSpreadsheetFile,
  type SheetTabInfo,
} from "@/lib/google-sheets-service";
import { MasterStore, type ProductItem } from "@/lib/store";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function GoogleSheetsSyncTab() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getGoogleAccessToken());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);

  // Export State
  const [exportMode, setExportMode] = useState<"new" | "existing">("new");
  const [newSheetTitle, setNewSheetTitle] = useState(() => {
    const today = new Date().toLocaleDateString("th-TH").replace(/\//g, "-");
    return `MiniMark - สินค้า & สต็อก (${today})`;
  });
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>("");
  const [spreadsheetMetadata, setSpreadsheetMetadata] = useState<{
    title: string;
    sheets: SheetTabInfo[];
    spreadsheetUrl: string;
  } | null>(null);
  const [selectedSheetTab, setSelectedSheetTab] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);

  // Import State
  const [importSpreadsheetId, setImportSpreadsheetId] = useState("");
  const [importTabName, setImportTabName] = useState("");
  const [importAvailableTabs, setImportAvailableTabs] = useState<SheetTabInfo[]>([]);
  const [isFetchingImportTabs, setIsFetchingImportTabs] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<string[][]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Destructive Confirmation Dialog State
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (currentUser, activeToken) => {
        setUser(currentUser);
        setToken(activeToken);
        loadSpreadsheets(activeToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setSpreadsheets([]);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogle();
      setUser(result.user);
      setToken(result.accessToken);
      toast.success(`เชื่อมต่อ Google สำเร็จ: ${result.user.displayName || result.user.email}`);
      loadSpreadsheets(result.accessToken);
    } catch (err: unknown) {
      console.error("Sign-in failed:", err);
      const msg = err instanceof Error ? err.message : "การเข้าสู่ระบบ Google ไม่สำเร็จ";
      toast.error(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutFromGoogle();
      setUser(null);
      setToken(null);
      setSpreadsheets([]);
      setSpreadsheetMetadata(null);
      toast.success("ออกจากระบบ Google เรียบร้อยแล้ว");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("ออกจากระบบไม่สำเร็จ: " + msg);
    }
  };

  const loadSpreadsheets = async (activeToken?: string) => {
    const t = activeToken || token || getGoogleAccessToken();
    if (!t) return;
    setIsLoadingSpreadsheets(true);
    try {
      const files = await listUserSpreadsheets(t);
      setSpreadsheets(files);
      if (files.length > 0 && !selectedSpreadsheetId) {
        setSelectedSpreadsheetId(files[0].id);
        fetchSpreadsheetTabs(files[0].id, t);
      }
    } catch (err: unknown) {
      console.error("Failed to load spreadsheets:", err);
    } finally {
      setIsLoadingSpreadsheets(false);
    }
  };

  const fetchSpreadsheetTabs = async (sheetId: string, activeToken?: string) => {
    if (!sheetId) return;
    try {
      const meta = await getSpreadsheetMetadata(sheetId, activeToken || token || undefined);
      setSpreadsheetMetadata(meta);
      if (meta.sheets.length > 0) {
        setSelectedSheetTab(meta.sheets[0].title);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch tabs:", err);
    }
  };

  const handleSelectExistingSheet = (id: string) => {
    setSelectedSpreadsheetId(id);
    fetchSpreadsheetTabs(id);
  };

  // 1. Export Products Action
  const triggerExportProducts = () => {
    const products = MasterStore.getProducts();
    if (products.length === 0) {
      toast.error("ไม่มีข้อมูลสินค้าในระบบเพื่อส่งออก");
      return;
    }

    if (exportMode === "new") {
      executeExportProducts(products);
    } else {
      // Modifying an existing spreadsheet is a mutating/overwriting operation
      // MANDATORY user confirmation dialog requirement
      setConfirmConfig({
        title: "ยืนยันการเขียนทับข้อมูลใน Google Sheets หรือไม่?",
        description: `ระบบจะนำข้อมูลสินค้าทั้งหมด ${products.length} รายการ ไปเขียนลงในสเปรดชีต "${spreadsheetMetadata?.title || selectedSpreadsheetId}" แท็บ "${selectedSheetTab}" ข้อมูลเดิมในแท็บดังกล่าวจะถูกอัปเดต`,
        onConfirm: async () => {
          await executeExportProducts(products);
        },
      });
      setConfirmDialogOpen(true);
    }
  };

  const executeExportProducts = async (products: ProductItem[]) => {
    setIsExporting(true);
    try {
      const rows = buildProductExportRows(products);
      if (exportMode === "new") {
        const title = newSheetTitle.trim() || "MiniMark Product Catalog";
        const res = await createNewSpreadsheet(title, "สินค้าทั้งหมด", rows);
        setLastExportUrl(res.spreadsheetUrl);
        toast.success(`ส่งออกสินค้า ${products.length} รายการสู่ Google Sheets สำเร็จ!`);
        loadSpreadsheets();
      } else {
        if (!selectedSpreadsheetId || !selectedSheetTab) {
          throw new Error("กรุณาเลือกไฟล์สเปรดชีตและแท็บที่ต้องการบันทึก");
        }
        await updateSpreadsheetRange(selectedSpreadsheetId, `'${selectedSheetTab}'!A1`, rows);
        const url = `https://docs.google.com/spreadsheets/d/${selectedSpreadsheetId}`;
        setLastExportUrl(url);
        toast.success(`อัปเดตข้อมูล ${products.length} รายการใน Google Sheets เรียบร้อย`);
      }
    } catch (err: unknown) {
      console.error("Export failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("เกิดข้อผิดพลาดในการส่งออก: " + msg);
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Fetch Tabs for Import
  const handleSelectImportFile = async (id: string) => {
    setImportSpreadsheetId(id);
    setIsFetchingImportTabs(true);
    try {
      const meta = await getSpreadsheetMetadata(id);
      setImportAvailableTabs(meta.sheets);
      if (meta.sheets.length > 0) {
        setImportTabName(meta.sheets[0].title);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("ไม่สามารถอ่านแท็บของสเปรดชีตได้: " + msg);
    } finally {
      setIsFetchingImportTabs(false);
    }
  };

  // 3. Preview Import Data
  const handlePreviewImport = async () => {
    if (!importSpreadsheetId || !importTabName) {
      toast.error("กรุณาเลือกสเปรดชีตและแท็บที่ต้องการอ่าน");
      return;
    }
    setIsPreviewing(true);
    try {
      const range = `'${importTabName}'!A1:O50`;
      const values = await readSpreadsheetValues(importSpreadsheetId, range);
      if (!values || values.length === 0) {
        toast.error("ไม่พบข้อมูลในแท็บที่เลือก");
        setImportPreviewRows([]);
      } else {
        setImportPreviewRows(values);
        toast.success(`อ่านข้อมูลตัวอย่างได้ ${values.length} แถว`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("ไม่สามารถอ่านข้อมูล: " + msg);
    } finally {
      setIsPreviewing(false);
    }
  };

  // 4. Trigger Confirm Import
  const triggerImportProducts = () => {
    if (importPreviewRows.length < 2) {
      toast.error("ต้องมีแถวหัวตารางและข้อมูลสินค้าอย่างน้อย 1 แถว");
      return;
    }

    const dataRowCount = importPreviewRows.length - 1;
    setConfirmConfig({
      title: "ยืนยันการนำเข้าข้อมูลสินค้าสู่ระบบร้านค้า?",
      description: `ระบบจะนำข้อมูลจำนวน ${dataRowCount} รายการ จาก Google Sheets เข้ามาบันทึกและอัปเดตสินค้าในร้าน MiniMark ข้อมูลบาร์โค้ดที่มีอยู่เดิมจะถูกอัปเดตราคาและสต็อก`,
      onConfirm: async () => {
        await executeImportProducts();
      },
    });
    setConfirmDialogOpen(true);
  };

  const executeImportProducts = async () => {
    setIsImporting(true);
    try {
      const headers = importPreviewRows[0].map((h) => h.trim().toLowerCase());
      const barcodeIdx = headers.findIndex((h) => h.includes("บาร์โค้ด") || h.includes("barcode"));
      const nameIdx = headers.findIndex((h) => h.includes("ชื่อ") || h.includes("name"));
      const costIdx = headers.findIndex((h) => h.includes("ต้นทุน") || h.includes("cost"));
      const priceIdx = headers.findIndex((h) => h.includes("ขาย") || h.includes("price"));
      const stockIdx = headers.findIndex((h) => h.includes("สต็อก") || h.includes("stock"));

      if (barcodeIdx === -1 || nameIdx === -1) {
        throw new Error("หัวตารางต้องมีคอลัมน์ 'บาร์โค้ด' และ 'ชื่อสินค้า' เป็นอย่างน้อย");
      }

      let updatedCount = 0;
      let addedCount = 0;
      const currentProducts = MasterStore.getProducts();
      const categories = MasterStore.getCategories();
      const units = MasterStore.getUnits();
      const defaultCatId = categories[0]?.id || "cat-food";
      const defaultUnitId = units[0]?.id || "unit-pcs";

      for (let i = 1; i < importPreviewRows.length; i++) {
        const row = importPreviewRows[i];
        const barcode = row[barcodeIdx]?.trim();
        const name = row[nameIdx]?.trim();
        if (!barcode || !name) continue;

        const cost = costIdx >= 0 ? parseFloat(row[costIdx]) || 0 : 0;
        const price = priceIdx >= 0 ? parseFloat(row[priceIdx]) || 0 : 0;
        const stock = stockIdx >= 0 ? parseInt(row[stockIdx], 10) || 0 : 0;

        const existing = currentProducts.find((p) => p.barcode === barcode);
        if (existing) {
          MasterStore.updateProduct(existing.id, {
            name,
            costPrice: cost > 0 ? cost : existing.costPrice,
            sellPrice: price > 0 ? price : existing.sellPrice,
            stock: stock >= 0 ? stock : existing.stock,
          });
          updatedCount++;
        } else {
          MasterStore.addProduct({
            barcode,
            sku: barcode.slice(-6).toUpperCase(),
            name,
            codeType: "Barcode",
            format: "EAN_13",
            categoryId: defaultCatId,
            unitId: defaultUnitId,
            costPrice: cost,
            sellPrice: price,
            stock: stock,
            minStock: 5,
            targetStock: 15,
            reorderQuantity: 15,
            isActive: true,
          });
          addedCount++;
        }
      }

      toast.success(
        `นำเข้าสำเร็จ: เพิ่มสินค้าใหม่ ${addedCount} รายการ, อัปเดต ${updatedCount} รายการ`,
      );
      setImportPreviewRows([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("นำเข้าข้อมูลไม่สำเร็จ: " + msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Google Account Connection Card */}
      <Card className="rounded-2xl border bg-card shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <FileSpreadsheet className="size-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <span>Google Sheets Sync Hub</span>
                  <Badge
                    variant={user ? "default" : "secondary"}
                    className={
                      user
                        ? "bg-emerald-600 text-white font-medium"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {user ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  ซิงค์ข้อมูลสต็อก นำเข้า-ส่งออกรายการสินค้า และจัดเก็บใน Google Drive ของคุณโดยตรง
                </CardDescription>
              </div>
            </div>

            <div>
              {user ? (
                <div className="flex items-center gap-2.5 bg-muted/40 p-2 rounded-xl border border-border/60">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "Google User"}
                      className="size-8 rounded-full border"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left min-w-0 pr-2">
                    <div className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                      {user.displayName || "ผู้ใช้ Google"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {user.email}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                    title="ออกจากระบบ Google"
                  >
                    <LogOut className="size-3.5 mr-1" /> ออก
                  </Button>
                </div>
              ) : (
                <GoogleSignInButton
                  onClick={handleSignIn}
                  isLoading={isSigningIn}
                  label="เข้าสู่ระบบด้วย Google"
                />
              )}
            </div>
          </div>
        </CardHeader>

        {!user && (
          <CardContent className="pt-0">
            <Alert className="rounded-xl bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200">
              <Info className="size-4 text-amber-600" />
              <AlertTitle className="text-xs font-semibold">
                ต้องเข้าสู่ระบบ Google ก่อนเริ่มใช้งาน
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                คลิกปุ่ม &quot;เข้าสู่ระบบด้วย Google&quot; ด้านบนเพื่ออนุญาตให้แอปพลิเคชันเข้าถึง
                Google Drive และ Google Sheets ได้อย่างปลอดภัย
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* 2. Main Sync Features (When Authenticated) */}
      {user && (
        <Tabs defaultValue="export" className="space-y-4">
          <TabsList className="grid grid-cols-3 max-w-md h-10 p-1 rounded-xl bg-muted">
            <TabsTrigger value="export" className="text-xs gap-1.5 rounded-lg">
              <ArrowUpFromLine className="size-3.5" /> ส่งออกสินค้า
            </TabsTrigger>
            <TabsTrigger value="import" className="text-xs gap-1.5 rounded-lg">
              <ArrowDownToLine className="size-3.5" /> นำเข้าข้อมูล
            </TabsTrigger>
            <TabsTrigger value="drive" className="text-xs gap-1.5 rounded-lg">
              <FolderOpen className="size-3.5" /> ไฟล์ในไดรฟ์ ({spreadsheets.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EXPORT PRODUCTS */}
          <TabsContent value="export" className="space-y-4">
            <Card className="rounded-2xl border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowUpFromLine className="size-4 text-primary" />
                  ส่งออกรายการสินค้าทั้งหมดสู่ Google Sheets
                </CardTitle>
                <CardDescription className="text-xs">
                  นำข้อมูลสินค้า บาร์โค้ด หมวดหมู่ ราคาต้นทุน และสต็อกคงเหลือส่งไปยัง Google
                  Spreadsheet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setExportMode("new")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      exportMode === "new"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/70 hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 mb-1">
                      <Plus className="size-3.5 text-primary" /> สร้างไฟล์ Google Sheet ใหม่
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      สร้างสเปรดชีตเล่มใหม่ใน Google Drive ของคุณทันที
                    </p>
                  </div>

                  <div
                    onClick={() => setExportMode("existing")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      exportMode === "existing"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/70 hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 mb-1">
                      <TableIcon className="size-3.5 text-emerald-600" />{" "}
                      อัปเดตในสเปรดชีตเดิมที่มีอยู่
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      เลือกไฟล์ที่มีอยู่แล้วใน Google Drive เพื่อเขียนข้อมูลลงในแท็บที่กำหนด
                    </p>
                  </div>
                </div>

                {exportMode === "new" ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">ชื่อไฟล์สเปรดชีตที่จะสร้าง</Label>
                    <Input
                      value={newSheetTitle}
                      onChange={(e) => setNewSheetTitle(e.target.value)}
                      placeholder="เช่น MiniMark - รายการสินค้า 2026"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">เลือกไฟล์ใน Google Drive</Label>
                      <Select
                        value={selectedSpreadsheetId}
                        onValueChange={handleSelectExistingSheet}
                      >
                        <SelectTrigger className="rounded-xl h-10 text-xs">
                          <SelectValue placeholder="เลือกสเปรดชีต..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 rounded-xl">
                          {spreadsheets.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">เลือกแท็บ (Worksheet Tab)</Label>
                      <Select
                        value={selectedSheetTab}
                        onValueChange={setSelectedSheetTab}
                        disabled={!spreadsheetMetadata || spreadsheetMetadata.sheets.length === 0}
                      >
                        <SelectTrigger className="rounded-xl h-10 text-xs">
                          <SelectValue placeholder="เลือกแท็บในชีต..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {spreadsheetMetadata?.sheets.map((tab) => (
                            <SelectItem key={tab.title} value={tab.title} className="text-xs">
                              {tab.title} ({tab.rowCount || 0} แถว)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={triggerExportProducts}
                    disabled={isExporting}
                    className="h-10 px-4 rounded-xl font-semibold text-xs gap-2 active:scale-95 shadow-sm"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> กำลังส่งออก...
                      </>
                    ) : (
                      <>
                        <ArrowUpFromLine className="size-4" /> ส่งออกสินค้า (
                        {MasterStore.getProducts().length} รายการ)
                      </>
                    )}
                  </Button>

                  {lastExportUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-10 px-3 rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10"
                    >
                      <a href={lastExportUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" /> เปิดใน Google Sheets
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: IMPORT PRODUCTS */}
          <TabsContent value="import" className="space-y-4">
            <Card className="rounded-2xl border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowDownToLine className="size-4 text-emerald-600" />
                  นำเข้าหรืออัปเดตสินค้าจาก Google Sheets
                </CardTitle>
                <CardDescription className="text-xs">
                  อ่านข้อมูลจากสเปรดชีตของคุณเพื่ออัปเดตราคา สต็อก
                  หรือเพิ่มรายการสินค้าใหม่เข้าระบบร้าน
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">เลือกไฟล์สเปรดชีตที่จะอ่าน</Label>
                    <Select value={importSpreadsheetId} onValueChange={handleSelectImportFile}>
                      <SelectTrigger className="rounded-xl h-10 text-xs">
                        <SelectValue placeholder="เลือกไฟล์จาก Google Drive..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 rounded-xl">
                        {spreadsheets.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">เลือกแท็บ (Worksheet Tab)</Label>
                    <Select
                      value={importTabName}
                      onValueChange={setImportTabName}
                      disabled={isFetchingImportTabs || importAvailableTabs.length === 0}
                    >
                      <SelectTrigger className="rounded-xl h-10 text-xs">
                        <SelectValue placeholder="เลือกแท็บที่ต้องการอ่าน..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {importAvailableTabs.map((t) => (
                          <SelectItem key={t.title} value={t.title} className="text-xs">
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviewImport}
                    disabled={!importSpreadsheetId || !importTabName || isPreviewing}
                    className="h-9 px-3 rounded-xl text-xs gap-1.5"
                  >
                    {isPreviewing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                    โหลดตัวอย่างข้อมูล (Preview)
                  </Button>

                  {importPreviewRows.length > 1 && (
                    <Button
                      size="sm"
                      onClick={triggerImportProducts}
                      disabled={isImporting}
                      className="h-9 px-3.5 rounded-xl font-semibold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isImporting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      ยืนยันนำเข้า {importPreviewRows.length - 1} รายการ
                    </Button>
                  )}
                </div>

                {/* Preview Table */}
                {importPreviewRows.length > 0 && (
                  <div className="rounded-xl border overflow-x-auto max-h-72 mt-3">
                    <Table>
                      <TableHeader className="bg-muted/60">
                        <TableRow>
                          {importPreviewRows[0].map((h, idx) => (
                            <TableHead
                              key={idx}
                              className="text-[11px] font-bold whitespace-nowrap py-2 px-3"
                            >
                              {h || `Col ${idx + 1}`}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewRows.slice(1, 11).map((row, rIdx) => (
                          <TableRow key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <TableCell
                                key={cIdx}
                                className="text-[11px] py-1.5 px-3 truncate max-w-[160px]"
                              >
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {importPreviewRows.length > 11 && (
                      <div className="p-2 text-center text-[10px] text-muted-foreground bg-muted/20 border-t">
                        แสดงตัวอย่าง 10 รายการแรก จากทั้งหมด {importPreviewRows.length - 1} รายการ
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: DRIVE SPREADSHEETS */}
          <TabsContent value="drive" className="space-y-4">
            <Card className="rounded-2xl border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FolderOpen className="size-4 text-primary" />
                    ไฟล์สเปรดชีตใน Google Drive ของคุณ
                  </CardTitle>
                  <CardDescription className="text-xs">
                    พบทั้งหมด {spreadsheets.length} ไฟล์ที่เชื่อมต่อกับบัญชี Google นี้
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadSpreadsheets()}
                  disabled={isLoadingSpreadsheets}
                  className="h-8 px-2.5 rounded-xl text-xs gap-1.5"
                >
                  <RefreshCw
                    className={`size-3.5 ${isLoadingSpreadsheets ? "animate-spin" : ""}`}
                  />
                  รีเฟรช
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingSpreadsheets ? (
                  <div className="py-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> กำลังโหลดรายการไฟล์จาก Google
                    Drive...
                  </div>
                ) : spreadsheets.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    ไม่พบไฟล์ Google Sheets ในไดรฟ์
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border overflow-hidden">
                    {spreadsheets.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">
                              {file.name}
                            </div>
                            {file.modifiedTime && (
                              <div className="text-[10px] text-muted-foreground">
                                แก้ไขล่าสุด: {new Date(file.modifiedTime).toLocaleString("th-TH")}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-2 text-xs text-primary hover:bg-primary/10 shrink-0"
                        >
                          <a
                            href={
                              file.webViewLink ||
                              `https://docs.google.com/spreadsheets/d/${file.id}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-3 mr-1" /> เปิด
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* 3. Explicit User Confirmation Dialog (MANDATORY per Workspace Integration skill) */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
              <AlertCircle className="size-5" />
              {confirmConfig?.title || "ยืนยันการทำรายการ"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {confirmConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl h-9 text-xs">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={async (e) => {
                e.preventDefault();
                setConfirmDialogOpen(false);
                if (confirmConfig?.onConfirm) {
                  await confirmConfig.onConfirm();
                }
              }}
            >
              ดำเนินการต่อ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
