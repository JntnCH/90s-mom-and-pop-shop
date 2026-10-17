import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Cloud,
  CloudCheck,
  CloudUpload,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Layers,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Table as TableIcon,
  Trash2,
  Sparkles,
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
import { Switch } from "@/components/ui/switch";
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
  backupFullDatabaseToGoogleSheets,
  buildProductExportRows,
  createNewSpreadsheet,
  getActiveBackupSheetMeta,
  getGoogleAccessToken,
  getSpreadsheetMetadata,
  initGoogleAuth,
  isAutoSyncToSheetsEnabled,
  listUserSpreadsheets,
  migrateAllSourcesToGoogleSheets,
  readSpreadsheetValues,
  restoreFullDatabaseFromGoogleSheets,
  saveActiveBackupSheetMeta,
  setAutoSyncToSheetsEnabled,
  signInWithGoogle,
  signOutFromGoogle,
  updateSpreadsheetRange,
  type DriveSpreadsheetFile,
  type GoogleSheetBackupMeta,
  type MigrationSummary,
  type SheetTabInfo,
  BACKUP_SHEET_TABS,
} from "@/lib/google-sheets-service";
import { MasterStore, type ProductItem } from "@/lib/store";
import { fetchCloudSqlSnapshotFn } from "@/lib/line-server-fn";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function GoogleSheetsSyncTab() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getGoogleAccessToken());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);

  // Full Database Backup State
  const [backupMeta, setBackupMeta] = useState<GoogleSheetBackupMeta | null>(() =>
    getActiveBackupSheetMeta(),
  );
  const [autoSync, setAutoSync] = useState<boolean>(() => isAutoSyncToSheetsEnabled());
  const [isFullBackingUp, setIsFullBackingUp] = useState(false);
  const [isFullRestoring, setIsFullRestoring] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);

  // Export State
  const [exportMode, setExportMode] = useState<"new" | "existing">("new");
  const [newSheetTitle, setNewSheetTitle] = useState(() => {
    const today = new Date().toLocaleDateString("th-TH").replace(/\//g, "-");
    return `โชห่วยยุค90s - ฐานข้อมูลสำรอง (${today})`;
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

    const onBackupSynced = () => {
      setBackupMeta(getActiveBackupSheetMeta());
      setAutoSync(isAutoSyncToSheetsEnabled());
    };
    window.addEventListener("minimark_google_sheet_synced", onBackupSynced);

    return () => {
      unsubscribe();
      window.removeEventListener("minimark_google_sheet_synced", onBackupSynced);
    };
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

  // Auto Sync Toggle Handler
  const handleToggleAutoSync = (checked: boolean) => {
    setAutoSync(checked);
    setAutoSyncToSheetsEnabled(checked);
    if (checked) {
      if (!backupMeta?.spreadsheetId) {
        toast.info("กรุณากดสำรองข้อมูลครั้งแรกเพื่อสร้างไฟล์ฐานข้อมูลสำรองใน Google Sheets ก่อน");
      } else {
        toast.success("เปิดระบบสำรองข้อมูลอัตโนมัติลง Google Sheets เรียบร้อย");
      }
    } else {
      toast.info("ปิดการสำรองข้อมูลอัตโนมัติแล้ว");
    }
  };

  const [isPullingCloudSql, setIsPullingCloudSql] = useState(false);

  // PULL LATEST DATA FROM CLOUD SQL TO LOCAL SYSTEM
  const handlePullCloudSqlToLocal = async () => {
    setIsPullingCloudSql(true);
    try {
      const res = await fetchCloudSqlSnapshotFn();
      if (res && res.data) {
        MasterStore.syncDatabaseSnapshot(
          res.data as Parameters<typeof MasterStore.syncDatabaseSnapshot>[0],
        );
        const count = res.data.products?.length ?? 0;
        toast.success(
          `ดึงข้อมูลจาก Cloud SQL สำเร็จ! (${count} สินค้า, ${res.data.movements?.length ?? 0} ประวัติสต็อก, ${res.data.purchaseOrders?.length ?? 0} ใบสั่งซื้อ)`,
        );
      } else {
        toast.info("ดึงข้อมูลจากเซิร์ฟเวอร์เสร็จสิ้น");
      }
    } catch (err: unknown) {
      console.error("Cloud SQL fetch failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("ไม่สามารถดึงข้อมูลจาก Cloud SQL ได้: " + msg);
    } finally {
      setIsPullingCloudSql(false);
    }
  };

  // MIGRATE ALL SOURCES (Cloud SQL + Local) TO GOOGLE SHEETS
  const handleMigrateAllToSheets = async () => {
    let activeToken = token || getGoogleAccessToken();
    if (!user || !activeToken) {
      toast.info("กำลังเปิดหน้าต่างเข้าสู่ระบบ Google เพื่อเชื่อมต่อ...");
      try {
        const signResult = await signInWithGoogle();
        setUser(signResult.user);
        setToken(signResult.accessToken);
        activeToken = signResult.accessToken;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "กรุณาเข้าสู่ระบบ Google เพื่อย้ายข้อมูล";
        toast.error(msg);
        return;
      }
    }

    setIsMigrating(true);
    setMigrationSummary(null);
    try {
      const res = await migrateAllSourcesToGoogleSheets({ token: activeToken });
      setMigrationSummary(res);
      setBackupMeta(getActiveBackupSheetMeta());
      toast.success(res.message);
      loadSpreadsheets(activeToken);
    } catch (err: unknown) {
      console.error("Migration failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("การย้ายข้อมูลไม่สำเร็จ: " + msg);
    } finally {
      setIsMigrating(false);
    }
  };

  // FULL DATABASE BACKUP HANDLER
  const handleExecuteFullBackup = async (forceNew: boolean = false) => {
    if (!user && !getGoogleAccessToken()) {
      toast.error("กรุณาเข้าสู่ระบบ Google ก่อนสำรองข้อมูล");
      return;
    }

    const products = MasterStore.getProducts();
    const movements = MasterStore.getMovements();
    const orders = MasterStore.getPurchaseOrders();

    setIsFullBackingUp(true);
    try {
      const targetId = forceNew ? undefined : backupMeta?.spreadsheetId;
      const resMeta = await backupFullDatabaseToGoogleSheets({
        spreadsheetId: targetId,
      });

      setBackupMeta(resMeta);
      setLastExportUrl(resMeta.spreadsheetUrl);
      toast.success(
        `สำรองข้อมูลทุกอย่างลง Google Sheets สำเร็จ! (${products.length} สินค้า, ${movements.length} ประวัติสต็อก, ${orders.length} ใบสั่งซื้อ)`,
      );
      loadSpreadsheets();
    } catch (err: unknown) {
      console.error("Full backup failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("สำรองข้อมูลไม่สำเร็จ: " + msg);
    } finally {
      setIsFullBackingUp(false);
    }
  };

  // FULL DATABASE RESTORE HANDLER
  const handleTriggerRestoreFromGoogleSheets = (sheetId: string, sheetTitle?: string) => {
    // Overwriting local database is a mutating operation
    // MANDATORY explicit user confirmation dialog
    setConfirmConfig({
      title: "ยืนยันการกู้คืนข้อมูลร้านค้าจาก Google Sheets หรือไม่?",
      description: `ระบบจะนำข้อมูลสินค้า ประวัติสต็อก และรายการต่าง ๆ จากสเปรดชีต "${sheetTitle || sheetId}" เข้ามาแทนที่ข้อมูลเดิมในระบบ โปรดตรวจสอบให้แน่ใจก่อนดำเนินการ`,
      onConfirm: async () => {
        setIsFullRestoring(true);
        try {
          const res = await restoreFullDatabaseFromGoogleSheets(sheetId);
          toast.success(res.message);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error("กู้คืนข้อมูลไม่สำเร็จ: " + msg);
        } finally {
          setIsFullRestoring(false);
        }
      },
    });
    setConfirmDialogOpen(true);
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
        const title = newSheetTitle.trim() || "โชห่วยยุค90s Product Catalog";
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
      description: `ระบบจะนำข้อมูลจำนวน ${dataRowCount} รายการ จาก Google Sheets เข้ามาบันทึกและอัปเดตสินค้าในร้าน โชห่วยยุค90s ข้อมูลบาร์โค้ดที่มีอยู่เดิมจะถูกอัปเดตราคาและสต็อก`,
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
      const defaultUnitId = units[0]?.id || "unit-piece";

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

  const productCount = MasterStore.getProducts().length;
  const movementCount = MasterStore.getMovements().length;
  const orderCount = MasterStore.getPurchaseOrders().length;
  const categoryCount = MasterStore.getCategories().length;

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
                  <span>Google Sheets Backup Database</span>
                  <Badge
                    variant={user ? "default" : "secondary"}
                    className={
                      user
                        ? "bg-emerald-600 text-white font-medium"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {user ? "เชื่อมต่อเรียบร้อย" : "ยังไม่ได้เชื่อมต่อ"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  จัดเก็บข้อมูลร้านค้าทุกอย่างลง Google Sheets
                  เพื่อเป็นฐานข้อมูลสำรองและนำไปใช้งานต่อ
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
                  label="เชื่อมต่อ Google Sheets"
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
                เชื่อมต่อบัญชี Google เพื่อเปิดใช้งานฐานข้อมูลสำรอง
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                คลิกปุ่ม &quot;เชื่อมต่อ Google Sheets&quot;
                ด้านบนเพื่ออนุญาตให้ระบบบันทึกและซิงค์ข้อมูลลง Google Sheets และ Google Drive
                ในบัญชีของคุณ
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* 2. Core Feature: Complete Backup Database to Google Sheets */}
      <Card className="rounded-2xl border border-primary/20 bg-linear-to-b from-primary/5 via-card to-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Database className="size-5" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <span>สำรองข้อมูลร้านค้าครบวงจร (Full Database Backup)</span>
                  <Badge variant="outline" className="text-[10px] bg-background">
                    6 แท็บข้อมูลอัตโนมัติ
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  บันทึกข้อมูลทุกอย่าง (สินค้า, สต็อก, ประวัติรับ-เบิก, ใบสั่งซื้อ, หมวดหมู่)
                  ลงในสเปรดชีตเล่มเดียว
                </CardDescription>
              </div>
            </div>

            {backupMeta && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 px-3 rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 shrink-0"
              >
                <a href={backupMeta.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" /> เปิดดูใน Google Sheets
                </a>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Active Backup Status Banner */}
          {backupMeta ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-foreground">
                    {backupMeta.spreadsheetTitle}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  สำรองล่าสุดเมื่อ:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(backupMeta.lastBackupAt).toLocaleString("th-TH")}
                  </span>{" "}
                  • สินค้า {backupMeta.stats.products} รายการ • ประวัติสต็อก{" "}
                  {backupMeta.stats.movements} รายการ • ใบสั่งซื้อ {backupMeta.stats.orders} รายการ
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleTriggerRestoreFromGoogleSheets(
                      backupMeta.spreadsheetId,
                      backupMeta.spreadsheetTitle,
                    )
                  }
                  disabled={isFullRestoring || !user}
                  className="h-8 text-xs rounded-xl gap-1 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                >
                  {isFullRestoring ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                  กู้คืนจากชีตนี้
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
              <Cloud className="size-4 text-muted-foreground shrink-0" />
              <span>
                ยังไม่มีไฟล์สเปรดชีตฐานข้อมูลสำรองหลัก คลิกปุ่ม &quot;สำรองข้อมูลทั้งหมดทันที&quot;
                ด้านล่างเพื่อสร้างไฟล์
              </span>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl border bg-background/50">
              <div className="text-[11px] text-muted-foreground">สินค้าในระบบ</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{productCount} รายการ</div>
            </div>
            <div className="p-2.5 rounded-xl border bg-background/50">
              <div className="text-[11px] text-muted-foreground">ประวัติเคลื่อนไหวสต็อก</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{movementCount} รายการ</div>
            </div>
            <div className="p-2.5 rounded-xl border bg-background/50">
              <div className="text-[11px] text-muted-foreground">ใบสั่งซื้อ PO</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{orderCount} ใบ</div>
            </div>
            <div className="p-2.5 rounded-xl border bg-background/50">
              <div className="text-[11px] text-muted-foreground">หมวดหมู่และข้อมูลหลัก</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{categoryCount} หมวด</div>
            </div>
          </div>

          {/* Migration Banner (Cloud SQL & Local -> Google Sheets) */}
          <div className="rounded-xl border border-indigo-500/20 bg-linear-to-r from-indigo-500/5 via-primary/5 to-card p-3.5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-foreground">
                    ย้ายข้อมูลจาก Cloud SQL & Local สู่ Google Sheets
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                  >
                    รวมทุกแหล่งข้อมูล
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ดึงข้อมูลสินค้า ประวัติสต็อก ใบสั่งซื้อ และหมวดหมู่จาก Cloud SQL
                  และระบบภายในเครื่อง มารวมและบันทึกลง Google Sheets ทันที
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePullCloudSqlToLocal}
                  disabled={isPullingCloudSql}
                  className="h-9 px-3 rounded-xl text-xs gap-1.5 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
                  title="ดึงข้อมูลล่าสุดจาก Cloud SQL มาบันทึกในระบบเครื่องนี้"
                >
                  {isPullingCloudSql ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  ดึงจาก Cloud SQL
                </Button>

                <Button
                  onClick={handleMigrateAllToSheets}
                  disabled={isMigrating}
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> กำลังย้ายข้อมูล...
                    </>
                  ) : (
                    <>
                      <Database className="size-3.5" /> ย้ายข้อมูลทุกที่สู่ Google Sheets
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Direct Product Table Preview (Answers 'สินค้าทั้งหมดล่ะ') */}
            <div className="pt-2 border-t border-indigo-500/10">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <TableIcon className="size-3.5 text-indigo-600" />
                  รายการสินค้าทั้งหมดในระบบที่จะถูกส่งขึ้น Google Sheets (
                  {MasterStore.getProducts().length} รายการ)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  สต็อกรวม: {MasterStore.getProducts().reduce((sum, p) => sum + (p.stock || 0), 0)}{" "}
                  ชิ้น
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border/60 bg-background/50">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-[11px]">
                      <TableHead className="py-1.5 h-7">บาร์โค้ด</TableHead>
                      <TableHead className="py-1.5 h-7">ชื่อสินค้า</TableHead>
                      <TableHead className="py-1.5 h-7">หมวดหมู่</TableHead>
                      <TableHead className="py-1.5 h-7 text-right">สต็อก</TableHead>
                      <TableHead className="py-1.5 h-7 text-right">ทุน</TableHead>
                      <TableHead className="py-1.5 h-7 text-right">ขาย</TableHead>
                      <TableHead className="py-1.5 h-7 text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MasterStore.getProducts().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                          ไม่พบรายการสินค้า กรุณากด &quot;ดึงจาก Cloud SQL&quot; ด้านบน
                        </TableCell>
                      </TableRow>
                    ) : (
                      MasterStore.getProducts().map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="py-1 font-mono text-[11px] text-muted-foreground">
                            {p.barcode}
                          </TableCell>
                          <TableCell className="py-1 font-medium text-foreground">
                            {p.name}
                          </TableCell>
                          <TableCell className="py-1 text-muted-foreground">
                            {MasterStore.getCategoryName(p.categoryId)}
                          </TableCell>
                          <TableCell className="py-1 text-right font-bold text-foreground">
                            {p.stock}
                          </TableCell>
                          <TableCell className="py-1 text-right text-muted-foreground">
                            ฿{p.costPrice}
                          </TableCell>
                          <TableCell className="py-1 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            ฿{p.sellPrice}
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                p.isActive
                                  ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/5"
                                  : "border-muted text-muted-foreground"
                              }`}
                            >
                              {p.isActive ? "ปกติ" : "ปิด"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Migration Success Result Card */}
          {migrationSummary && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                <span>ผลการย้ายข้อมูล: {migrationSummary.message}</span>
                <a
                  href={migrationSummary.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-normal text-[11px]"
                >
                  <ExternalLink className="size-3" /> เปิด Google Sheet
                </a>
              </div>
              <div className="text-[11px] text-muted-foreground">
                สินค้า {migrationSummary.counts.products} รายการ • ประวัติสต็อก{" "}
                {migrationSummary.counts.movements} รายการ • ใบสั่งซื้อ{" "}
                {migrationSummary.counts.orders} ใบ • หมวดหมู่ {migrationSummary.counts.categories}{" "}
                หมวด • แหล่งที่มา: {migrationSummary.cloudSqlSource}
              </div>
            </div>
          )}

          {/* Auto-Backup Toggle & Backup Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/60">
            <div className="flex items-center gap-3">
              <Switch
                id="auto-sync-sheets"
                checked={autoSync}
                onCheckedChange={handleToggleAutoSync}
                disabled={!user}
              />
              <Label htmlFor="auto-sync-sheets" className="text-xs cursor-pointer">
                <span className="font-semibold block text-foreground">
                  สำรองข้อมูลอัตโนมัติ (Auto-Sync to Sheets)
                </span>
                <span className="text-muted-foreground text-[11px]">
                  บันทึกลง Google Sheets ทันทีที่มีการเพิ่ม/แก้ไขสินค้า สแกนของ หรือเปิดใบสั่งซื้อ
                </span>
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleExecuteFullBackup(false)}
                disabled={isFullBackingUp || !user}
                className="h-9 px-4 rounded-xl font-semibold text-xs gap-2 active:scale-95 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isFullBackingUp ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> กำลังสำรองข้อมูลทุกอย่าง...
                  </>
                ) : (
                  <>
                    <CloudUpload className="size-4" /> สำรองข้อมูลทั้งหมดทันที
                  </>
                )}
              </Button>

              {backupMeta && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExecuteFullBackup(true)}
                  disabled={isFullBackingUp || !user}
                  className="h-9 px-3 rounded-xl text-xs gap-1"
                  title="สร้างเป็นไฟล์สเปรดชีตเล่มใหม่ แทนที่จะเขียนทับเล่มเดิม"
                >
                  <Plus className="size-3.5" /> สร้างเล่มใหม่
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Granular Operations Tabs (Export, Import, Drive) */}
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
                  ส่งออกรายการสินค้าเฉพาะเจาะจงสู่ Google Sheets
                </CardTitle>
                <CardDescription className="text-xs">
                  ส่งเฉพาะตารางสินค้า บาร์โค้ด หมวดหมู่ ราคาต้นทุน
                  และสต็อกคงเหลือไปยังแท็บที่ต้องการ
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
                      placeholder="เช่น โชห่วยยุค90s - รายการสินค้า 2026"
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTriggerRestoreFromGoogleSheets(file.id, file.name)}
                            className="h-7 px-2 text-[11px] gap-1 text-amber-700 dark:text-amber-300"
                          >
                            <RotateCcw className="size-3" /> กู้คืน
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
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
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* 4. Explicit User Confirmation Dialog (MANDATORY per Workspace Integration skill) */}
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
