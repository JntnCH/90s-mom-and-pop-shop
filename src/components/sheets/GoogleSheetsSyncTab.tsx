import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Cloud,
  CloudCheck,
  CloudUpload,
  Copy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Key,
  Layers,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Table as TableIcon,
  Trash2,
  Sparkles,
  Upload,
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
import { Textarea } from "@/components/ui/textarea";
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
  checkGoogleSheetsConfig,
  saveGoogleSheetsConfigFn,
  testGoogleSheetsConnectionFn,
  resolveAccessToken,
  extractSpreadsheetId,
  type GoogleSheetsConfigStatus,
  disconnectServiceAccount,
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

  // Service Account State (ตั้งค่าครั้งเดียวไม่ต้องล็อกอินซ้ำ)
  const [serviceAccountConfig, setServiceAccountConfig] = useState<GoogleSheetsConfigStatus | null>(
    null,
  );
  const [isLoadingSaConfig, setIsLoadingSaConfig] = useState(true);
  const [showSaConfigForm, setShowSaConfigForm] = useState(false);
  const [saInputMode, setSaInputMode] = useState<"json" | "manual">("json");
  const [saJsonInput, setSaJsonInput] = useState("");
  const [saEmailInput, setSaEmailInput] = useState("");
  const [saKeyInput, setSaKeyInput] = useState("");
  const [saSpreadsheetInput, setSaSpreadsheetInput] = useState("");
  const [isSavingSa, setIsSavingSa] = useState(false);
  const [isTestingSa, setIsTestingSa] = useState(false);
  const [saTestResult, setSaTestResult] = useState<{
    success: boolean;
    title?: string;
    tabs?: string[];
    message: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const hasValidAuth = Boolean(user || serviceAccountConfig?.isConfigured || token);

  const refreshSaConfig = async () => {
    setIsLoadingSaConfig(true);
    try {
      const cfg = await checkGoogleSheetsConfig();
      setServiceAccountConfig(cfg);
      if (cfg.spreadsheetId) {
        setSaSpreadsheetInput((prev) => prev || cfg.spreadsheetId || "");
        if (!selectedSpreadsheetId) {
          setSelectedSpreadsheetId(cfg.spreadsheetId);
          setImportSpreadsheetId(cfg.spreadsheetId);
        }
      }
      if (cfg.isConfigured) {
        try {
          const saToken = await resolveAccessToken();
          setToken(saToken);
          if (cfg.spreadsheetId) {
            fetchSpreadsheetTabs(cfg.spreadsheetId, saToken);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn("Failed to check service account config:", err);
    } finally {
      setIsLoadingSaConfig(false);
    }
  };

  // Initialize Auth
  useEffect(() => {
    void refreshSaConfig();

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

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const email = ((parsed["client_email"] || parsed["clientEmail"]) as string) || "";
        const key = ((parsed["private_key"] || parsed["privateKey"]) as string) || "";
        if (!email || !key) {
          toast.error("ไฟล์ JSON ไม่มี client_email หรือ private_key ที่ถูกต้อง");
          return;
        }
        setSaJsonInput(text);
        setSaEmailInput(email);
        setSaKeyInput(key);
        setSaInputMode("json");
        toast.success(`อ่านไฟล์ JSON Service Account สำเร็จ (${email})`);
      } catch {
        toast.error(
          "ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบว่าเป็นไฟล์ JSON ที่ถูกต้องจาก Google Cloud",
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDisconnectServiceAccount = () => {
    setConfirmConfig({
      title: "ยืนยันการตัดการเชื่อมต่อ Service Account หรือไม่?",
      description:
        "ระบบจะลบการเชื่อมต่อ Service Account ออกจากการตั้งค่า หากต้องการกลับมาใช้งานใหม่สามารถอัปโหลดไฟล์ JSON ได้ตลอดเวลา",
      onConfirm: async () => {
        try {
          const res = await disconnectServiceAccount();
          if (res.success) {
            toast.success(res.message);
            setServiceAccountConfig(null);
            setToken(null);
            setShowSaConfigForm(true);
            await refreshSaConfig();
          } else {
            toast.error(res.message);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      },
    });
    setConfirmDialogOpen(true);
  };

  const handleSaveServiceAccount = async () => {
    setIsSavingSa(true);
    setSaTestResult(null);
    try {
      const res = await saveGoogleSheetsConfigFn({
        jsonKey: saInputMode === "json" ? saJsonInput : undefined,
        clientEmail: saInputMode === "manual" ? saEmailInput : undefined,
        privateKey: saInputMode === "manual" ? saKeyInput : undefined,
        spreadsheetId: saSpreadsheetInput,
      });

      if (!res.success) {
        toast.error(res.error || "บันทึก Service Account ไม่สำเร็จ");
        return;
      }

      toast.success(res.message);
      setShowSaConfigForm(false);
      setSaJsonInput("");
      setSaKeyInput("");
      await refreshSaConfig();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingSa(false);
    }
  };

  const handleTestServiceAccountConnection = async (targetId?: string) => {
    const idToTest =
      targetId || saSpreadsheetInput || serviceAccountConfig?.spreadsheetId || undefined;
    setIsTestingSa(true);
    setSaTestResult(null);
    try {
      const res = await testGoogleSheetsConnectionFn({
        spreadsheetId: idToTest,
      });
      if (res.success) {
        setSaTestResult({
          success: true,
          title: res.title,
          tabs: res.tabs,
          message: res.message,
        });
        toast.success(res.message);
      } else {
        setSaTestResult({
          success: false,
          message: res.error || "ทดสอบไม่สำเร็จ",
        });
        toast.error(res.error || "ทดสอบไม่สำเร็จ");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaTestResult({
        success: false,
        message: msg,
      });
      toast.error(msg);
    } finally {
      setIsTestingSa(false);
    }
  };

  const handleCopyClientEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      toast.success(
        "คัดลอกอีเมล Service Account แล้ว นำไปแชร์สิทธิ์ Editor ใน Google Sheet ได้เลย",
      );
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      toast.error("ไม่สามารถคัดลอกได้");
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
    if (!activeToken) {
      try {
        activeToken = await resolveAccessToken();
        setToken(activeToken);
      } catch {
        toast.info("กำลังเปิดหน้าต่างเข้าสู่ระบบ Google เพื่อเชื่อมต่อ...");
        try {
          const signResult = await signInWithGoogle();
          setUser(signResult.user);
          setToken(signResult.accessToken);
          activeToken = signResult.accessToken;
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : "กรุณาเข้าสู่ระบบ Google หรือตั้งค่า Service Account เพื่อย้ายข้อมูล";
          toast.error(msg);
          return;
        }
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
    let activeToken = token || getGoogleAccessToken();
    if (!activeToken) {
      try {
        activeToken = await resolveAccessToken();
        setToken(activeToken);
      } catch {
        toast.error("กรุณาตั้งค่า Service Account หรือเข้าสู่ระบบ Google ก่อนสำรองข้อมูล");
        return;
      }
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
      const range = `'${importTabName}'!A1:O`;
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
      {/* 1. PRIMARY: SERVICE ACCOUNT CONFIGURATION (SETUP ONCE, WORKS EVERYWHERE) */}
      <Card className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-background shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Key className="size-5" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 flex-wrap">
                  <span>Google Service Account (ตั้งค่าครั้งเดียวไม่ต้องล็อกอินซ้ำ)</span>
                  <Badge
                    variant={serviceAccountConfig?.isConfigured ? "default" : "secondary"}
                    className={
                      serviceAccountConfig?.isConfigured
                        ? "bg-emerald-600 text-white font-medium text-[10px]"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]"
                    }
                  >
                    {serviceAccountConfig?.isConfigured
                      ? "✅ เชื่อมต่อแล้ว"
                      : "⚠️ ยังไม่ได้ตั้งค่า"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  กำหนดค่า Service Account เพียงครั้งเดียว
                  เพื่อให้ทุกคนใช้งานสำรองข้อมูลและส่งออกได้อัตโนมัติ โดยไม่ต้องกดล็อกอิน Google
                  ทุกครั้ง
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {serviceAccountConfig?.isConfigured && !showSaConfigForm ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-xl gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={() => handleTestServiceAccountConnection()}
                    disabled={isTestingSa}
                  >
                    {isTestingSa ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    ทดสอบเชื่อมต่อ
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs rounded-xl gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSaConfigForm(true)}
                  >
                    <Settings2 className="size-3.5" />
                    แก้ไข
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs rounded-xl gap-1 text-destructive hover:bg-destructive/10"
                    onClick={handleDisconnectServiceAccount}
                  >
                    <Trash2 className="size-3.5" />
                    ตัดการเชื่อมต่อ
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant={showSaConfigForm ? "outline" : "default"}
                  className="h-8 text-xs rounded-xl gap-1.5"
                  onClick={() => setShowSaConfigForm(!showSaConfigForm)}
                >
                  <Key className="size-3.5" />
                  {showSaConfigForm ? "ปิดแบบฟอร์ม" : "ตั้งค่า Service Account"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Active Status Display */}
          {serviceAccountConfig?.isConfigured && !showSaConfigForm && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>อีเมล Service Account:</span>
                    <code className="px-2 py-0.5 rounded bg-background border font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                      {serviceAccountConfig.clientEmail}
                    </code>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {serviceAccountConfig.source === "file"
                        ? "บันทึกในเครื่อง (.data)"
                        : serviceAccountConfig.source === "env"
                          ? "Environment Variable"
                          : "บันทึกแล้ว"}
                    </Badge>
                  </div>
                  {serviceAccountConfig.clientEmail && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary hover:bg-primary/10 shrink-0"
                      onClick={() => handleCopyClientEmail(serviceAccountConfig.clientEmail!)}
                    >
                      {copiedEmail ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copiedEmail ? "คัดลอกแล้ว" : "คัดลอกอีเมล"}
                    </Button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-emerald-500/20">
                  <div className="flex items-center gap-1.5">
                    <span>Google Sheet เริ่มต้น:</span>
                    <span className="font-mono text-foreground font-medium">
                      {serviceAccountConfig.spreadsheetId || "ใช้ตามรายการที่เลือกในระบบ"}
                    </span>
                  </div>
                  {serviceAccountConfig.spreadsheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${serviceAccountConfig.spreadsheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:underline text-xs"
                    >
                      <ExternalLink className="size-3" /> เปิด Google Sheet เล่มนี้
                    </a>
                  )}
                </div>
              </div>

              {/* Instructions Reminder */}
              <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 px-1">
                <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  <strong>สำคัญ:</strong> เพื่อให้ Service Account สามารถอ่านและบันทึกข้อมูลได้
                  กรุณากดปุ่ม <strong>แชร์ (Share)</strong> ใน Google Sheet
                  แล้วเพิ่มอีเมลด้านบนพร้อมเลือกสิทธิ์{" "}
                  <strong>&quot;ผู้แก้ไข (Editor)&quot;</strong>
                </span>
              </div>
            </div>
          )}

          {/* Configuration Form (when opening setup or editing) */}
          {(showSaConfigForm || !serviceAccountConfig?.isConfigured) && (
            <div className="p-4 rounded-xl border bg-card space-y-4 animate-in fade-in-50">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={handleJsonFileUpload}
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Key className="size-4 text-primary" />
                  กรอกข้อมูล Google Service Account:
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs rounded-lg gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5 text-emerald-600" />
                    อัปโหลดไฟล์ JSON (.json)
                  </Button>
                  <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        saInputMode === "json"
                          ? "bg-background text-foreground shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSaInputMode("json")}
                    >
                      เนื้อหา JSON
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        saInputMode === "manual"
                          ? "bg-background text-foreground shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSaInputMode("manual")}
                    >
                      กรอก Email & Key
                    </button>
                  </div>
                </div>
              </div>

              {saInputMode === "json" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    วางเนื้อหาไฟล์ Service Account JSON (Key File):
                  </Label>
                  <Textarea
                    placeholder='{"type": "service_account", "project_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\n...", "client_email": "..."}'
                    value={saJsonInput}
                    onChange={(e) => setSaJsonInput(e.target.value)}
                    rows={5}
                    className="font-mono text-xs rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    คัดลอกจากไฟล์ JSON ที่ดาวน์โหลดจาก Google Cloud Console (IAM & Admin ➔ Service
                    Accounts ➔ Keys ➔ Add Key)
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Client Email (อีเมลของ Service Account):
                    </Label>
                    <Input
                      placeholder="xxx@project-id.iam.gserviceaccount.com"
                      value={saEmailInput}
                      onChange={(e) => setSaEmailInput(e.target.value)}
                      className="font-mono text-xs rounded-xl h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Private Key (คีย์ส่วนตัว RSA):</Label>
                    <Textarea
                      placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                      value={saKeyInput}
                      onChange={(e) => setSaKeyInput(e.target.value)}
                      rows={4}
                      className="font-mono text-xs rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  รหัส Google Spreadsheet ID หรือ ลิงก์ Google Sheet:
                </Label>
                <Input
                  placeholder="เช่น https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit หรือเฉพาะรหัส ID"
                  value={saSpreadsheetInput}
                  onChange={(e) => setSaSpreadsheetInput(e.target.value)}
                  className="font-mono text-xs rounded-xl h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  (ไม่บังคับ) หากระบุ ระบบจะใช้สเปรดชีตเล่มนี้เป็นฐานข้อมูลหลักอัตโนมัติ
                </p>
              </div>

              {/* Instructions guide */}
              <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1.5 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="size-3.5 text-primary" /> ขั้นตอนการตั้งค่า Service Account ง่ายๆ
                  4 ขั้นตอน:
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px]">
                  <li>
                    เปิด <strong>Google Cloud Console</strong> เลือกโปรเจกต์ และไปที่{" "}
                    <strong>IAM & Admin ➔ Service Accounts</strong>
                  </li>
                  <li>
                    สร้าง Service Account ใหม่ และสร้าง <strong>Key (เลือกแบบ JSON)</strong>{" "}
                    ไฟล์จะถูกดาวน์โหลดลงเครื่อง
                  </li>
                  <li>
                    เปิดใช้งาน <strong>Google Sheets API</strong> และ{" "}
                    <strong>Google Drive API</strong> ใน API Library
                  </li>
                  <li>
                    เปิด Google Sheet ที่ต้องการ กดปุ่ม <strong>แชร์ (Share)</strong> ➔ นำอีเมล
                    Service Account ไปใส่ และให้สิทธิ์ <strong>Editor</strong>
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                {serviceAccountConfig?.isConfigured && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 rounded-xl text-xs"
                    onClick={() => setShowSaConfigForm(false)}
                  >
                    ยกเลิก
                  </Button>
                )}
                {saSpreadsheetInput && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 rounded-xl text-xs gap-1.5"
                    onClick={() => handleTestServiceAccountConnection(saSpreadsheetInput)}
                    disabled={isTestingSa}
                  >
                    {isTestingSa ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    ทดสอบเชื่อมต่อ
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  onClick={handleSaveServiceAccount}
                  disabled={isSavingSa}
                >
                  {isSavingSa ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  บันทึกการตั้งค่า Service Account
                </Button>
              </div>
            </div>
          )}

          {/* Test Result Display */}
          {saTestResult && (
            <Alert
              className={`rounded-xl ${
                saTestResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                  : "bg-destructive/10 border-destructive/30 text-destructive dark:text-red-300"
              }`}
            >
              {saTestResult.success ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
              <AlertTitle className="text-xs font-bold">
                {saTestResult.success ? "การทดสอบเชื่อมต่อสำเร็จ" : "การทดสอบเชื่อมต่อไม่สำเร็จ"}
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">{saTestResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 2. SECONDARY: GOOGLE PERSONAL ACCOUNT (ALTERNATIVE) */}
      <Card className="rounded-2xl border bg-card shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center border shrink-0">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <span>เชื่อมต่อ Google Account ส่วนบุคคล</span>
                  <Badge
                    variant={user ? "default" : "secondary"}
                    className={
                      user
                        ? "bg-emerald-600 text-white font-medium text-[10px]"
                        : "bg-muted text-muted-foreground text-[10px]"
                    }
                  >
                    {user ? "เชื่อมต่อเรียบร้อย" : "ไม่ได้เชื่อมต่อ"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  ทางเลือกเพิ่มเติมสำหรับการเชื่อมต่อด้วยบัญชี Google ส่วนบุคคล (Popup / Redirect)
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
                  label="เข้าสู่ระบบ Google"
                />
              )}
            </div>
          </div>
        </CardHeader>

        {!hasValidAuth && (
          <CardContent className="pt-0">
            <Alert className="rounded-xl bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200">
              <Info className="size-4 text-amber-600" />
              <AlertTitle className="text-xs font-semibold">
                เชื่อมต่อ Service Account หรือบัญชี Google เพื่อเปิดใช้งานฐานข้อมูลสำรอง
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                กำหนดค่า Service Account ด้านบน (แนะนำ) หรือคลิกปุ่ม &quot;เข้าสู่ระบบ Google&quot;
                เพื่อเปิดใช้งานการสำรองข้อมูลลง Google Sheets
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
                  disabled={isFullRestoring || !hasValidAuth}
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
                disabled={!hasValidAuth}
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
                disabled={isFullBackingUp || !hasValidAuth}
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
                  disabled={isFullBackingUp || !hasValidAuth}
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
      {hasValidAuth && (
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
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">เลือกหรือระบุ Google Sheet</Label>
                        {serviceAccountConfig?.spreadsheetId &&
                          selectedSpreadsheetId !== serviceAccountConfig.spreadsheetId && (
                            <button
                              type="button"
                              className="text-[11px] text-primary hover:underline font-medium"
                              onClick={() =>
                                handleSelectExistingSheet(serviceAccountConfig.spreadsheetId!)
                              }
                            >
                              ใช้ชีตเริ่มต้น
                            </button>
                          )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="วางลิงก์ Google Sheet หรือใส่ ID"
                          value={selectedSpreadsheetId}
                          onChange={(e) => {
                            const clean = extractSpreadsheetId(e.target.value);
                            setSelectedSpreadsheetId(clean);
                            if (clean.length > 10) fetchSpreadsheetTabs(clean);
                          }}
                          className="rounded-xl h-10 text-xs font-mono"
                        />
                        {spreadsheets.length > 0 && (
                          <Select
                            value={selectedSpreadsheetId}
                            onValueChange={handleSelectExistingSheet}
                          >
                            <SelectTrigger className="w-[130px] rounded-xl h-10 text-xs shrink-0">
                              <SelectValue placeholder="จากไดรฟ์" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 rounded-xl">
                              {spreadsheets.map((s) => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
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
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        เลือกหรือระบุ Google Sheet ที่จะอ่าน
                      </Label>
                      {serviceAccountConfig?.spreadsheetId &&
                        importSpreadsheetId !== serviceAccountConfig.spreadsheetId && (
                          <button
                            type="button"
                            className="text-[11px] text-primary hover:underline font-medium"
                            onClick={() =>
                              handleSelectImportFile(serviceAccountConfig.spreadsheetId!)
                            }
                          >
                            ใช้ชีตเริ่มต้น
                          </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="วางลิงก์ Google Sheet หรือใส่ ID"
                        value={importSpreadsheetId}
                        onChange={(e) => {
                          const clean = extractSpreadsheetId(e.target.value);
                          setImportSpreadsheetId(clean);
                          if (clean.length > 10) handleSelectImportFile(clean);
                        }}
                        className="rounded-xl h-10 text-xs font-mono"
                      />
                      {spreadsheets.length > 0 && (
                        <Select value={importSpreadsheetId} onValueChange={handleSelectImportFile}>
                          <SelectTrigger className="w-[130px] rounded-xl h-10 text-xs shrink-0">
                            <SelectValue placeholder="จากไดรฟ์" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 rounded-xl">
                            {spreadsheets.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
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
