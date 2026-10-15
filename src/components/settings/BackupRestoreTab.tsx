import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileCheck,
  FileJson,
  HardDrive,
  Info,
  KeyRound,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AuthService } from "@/lib/auth-rbac";
import { BackupService, type BackupPackage, type DatabaseStats } from "@/lib/backup-restore";

export function BackupRestoreTab() {
  const [stats, setStats] = useState<DatabaseStats>(BackupService.getDatabaseStats());
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includePrinters, setIncludePrinters] = useState(true);
  const [includeStaff, setIncludeStaff] = useState(true);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupPackage | null>(null);
  const [restoreMode, setRestoreMode] = useState<"OVERWRITE" | "MERGE">("OVERWRITE");

  // Danger Zone Confirmation Modal
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [dangerAction, setDangerAction] = useState<"CLEAR_TX" | "CLEAR_MOCK" | "FACTORY_RESET">(
    "CLEAR_MOCK",
  );
  const [confirmPin, setConfirmPin] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = () => {
    setStats(BackupService.getDatabaseStats());
  };

  useEffect(() => {
    loadStats();
    const handleStoreChange = () => loadStats();
    window.addEventListener("minimark_store_change", handleStoreChange);
    window.addEventListener("minimark_print_jobs_change", handleStoreChange);
    window.addEventListener("minimark_auth_change", handleStoreChange);
    return () => {
      window.removeEventListener("minimark_store_change", handleStoreChange);
      window.removeEventListener("minimark_print_jobs_change", handleStoreChange);
      window.removeEventListener("minimark_auth_change", handleStoreChange);
    };
  }, []);

  const handleExportBackup = () => {
    try {
      const backupPackage = BackupService.generateBackupPackage({
        includeTransactions,
        includePrinters,
        includeStaff,
      });

      BackupService.downloadBackupFile(backupPackage);
      toast.success(
        `สำรองข้อมูลสำเร็จ: บันทึกข้อมูล ${backupPackage.metadata.totalProducts} รายการเรียบร้อย`,
      );
      loadStats();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสำรองข้อมูล");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = BackupService.validateBackupFile(content);

      if (!validation.isValid || !validation.package) {
        toast.error(validation.error || "ไฟล์สำรองข้อมูลไม่ถูกต้อง");
        return;
      }

      setPendingBackup(validation.package);
      setRestoreModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;

    const res = BackupService.restoreBackup(pendingBackup, restoreMode);
    if (res.success) {
      setRestoreModalOpen(false);
      setPendingBackup(null);
      toast.success(
        `กู้คืนข้อมูลสำเร็จ (${restoreMode === "OVERWRITE" ? "เขียนทับ" : "ผสานข้อมูล"}): ${res.stats.products} สินค้า, ${res.stats.orders} ใบสั่งซื้อ`,
      );
      loadStats();
    } else {
      toast.error(res.error || "กู้คืนข้อมูลไม่สำเร็จ");
    }
  };

  const handleOpenDangerAction = (action: "CLEAR_TX" | "CLEAR_MOCK" | "FACTORY_RESET") => {
    setDangerAction(action);
    setConfirmPin("");
    setDangerModalOpen(true);
  };

  const handleConfirmDangerAction = () => {
    const override = AuthService.verifyAdminOverride(confirmPin);
    if (!override.success) {
      toast.error("รหัส PIN สำหรับยืนยันไม่ถูกต้อง (ต้องเป็นรหัส Admin หรือ Manager)");
      return;
    }

    if (dangerAction === "CLEAR_TX") {
      BackupService.clearTransactionsOnly();
      toast.success("ล้างประวัติธุรกรรมและคิวงานพิมพ์เรียบร้อยแล้ว (ข้อมูลสินค้าคงเดิม)");
    } else if (dangerAction === "CLEAR_MOCK") {
      BackupService.clearAllMockData();
      toast.success("ล้างข้อมูลทดลองทั้งหมดเรียบร้อยแล้ว พร้อมเริ่มใช้งานข้อมูลจริง 100%");
    } else if (dangerAction === "FACTORY_RESET") {
      BackupService.factoryResetAndSeed();
      toast.success("คืนค่าเริ่มต้นจากโรงงานและโหลดชุดข้อมูลตัวอย่างเรียบร้อย");
    }

    setDangerModalOpen(false);
    loadStats();
  };

  return (
    <div className="space-y-6">
      {/* Database KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
            <Database className="size-3.5 text-primary" /> สินค้าในระบบ
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-0.5">
            {stats.productsCount} รายการ
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            รวมสต็อก {stats.totalStockUnits.toLocaleString()} ชิ้น
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
            <Layers className="size-3.5 text-emerald-600" /> ข้อมูลโครงสร้าง
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 mt-0.5">
            {stats.categoriesCount + stats.zonesCount + stats.unitsCount} รายการ
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {stats.categoriesCount} หมวด • {stats.zonesCount} โซน • {stats.unitsCount} หน่วย
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
            <Clock className="size-3.5 text-purple-600" /> ประวัติธุรกรรม
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-purple-600 mt-0.5">
            {stats.movementsCount + stats.purchaseOrdersCount} รายการ
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {stats.purchaseOrdersCount} PO • {stats.movementsCount} รับ/จ่าย
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
            <HardDrive className="size-3.5 text-amber-600" /> ขนาดฐานข้อมูล
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 mt-0.5">
            ~{stats.approxStorageKb} KB
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {stats.lastBackupDate
              ? `ล่าสุด: ${stats.lastBackupDate.split(" ")[0]}`
              : "ยังไม่เคยสำรอง"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* EXPORT BACKUP CARD */}
        <Card className="rounded-2xl border-border/80 shadow-sm flex flex-col justify-between">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="size-5 text-primary" /> สำรองข้อมูลลงเครื่อง (Export JSON)
            </CardTitle>
            <CardDescription className="text-xs">
              ดาวน์โหลดชุดข้อมูลทั้งหมดของร้าน โชห่วยยุค90s เป็นไฟล์มาตรฐาน JSON
              สำหรับจัดเก็บภายนอกหรือย้ายเครื่อง
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 pt-1 space-y-4">
            <div className="space-y-2.5 rounded-xl border p-3 bg-muted/30 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <FileCheck className="size-4 text-primary" /> ตัวเลือกข้อมูลที่ต้องการสำรอง:
              </div>
              <div className="space-y-2 pl-1 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox id="chk-products" checked={true} disabled={true} className="rounded" />
                  <label htmlFor="chk-products" className="text-xs cursor-pointer font-medium">
                    ข้อมูลสินค้า, หมวดหมู่, หน่วยนับ และโซนจัดเก็บ (บังคับ)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="chk-tx"
                    checked={includeTransactions}
                    onCheckedChange={(c) => setIncludeTransactions(!!c)}
                    className="rounded"
                  />
                  <label htmlFor="chk-tx" className="text-xs cursor-pointer">
                    ประวัติการรับเข้า-เบิกออก, ใบสั่งซื้อ (PO), และคิวงานพิมพ์
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="chk-ptr"
                    checked={includePrinters}
                    onCheckedChange={(c) => setIncludePrinters(!!c)}
                    className="rounded"
                  />
                  <label htmlFor="chk-ptr" className="text-xs cursor-pointer">
                    การตั้งค่าเครื่องพิมพ์สลิปความร้อนและเทมเพลต ESC/POS
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="chk-staff"
                    checked={includeStaff}
                    onCheckedChange={(c) => setIncludeStaff(!!c)}
                    className="rounded"
                  />
                  <label htmlFor="chk-staff" className="text-xs cursor-pointer">
                    รายชื่อพนักงาน, บทบาทหน้าที่ และรหัส PIN (RBAC)
                  </label>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-11 text-xs font-semibold rounded-xl gap-2 shadow-sm bg-primary text-primary-foreground"
              onClick={handleExportBackup}
            >
              <Download className="size-4" /> ดาวน์โหลดไฟล์สำรองข้อมูล (.JSON) ทันที
            </Button>
          </CardContent>
        </Card>

        {/* IMPORT / RESTORE CARD */}
        <Card className="rounded-2xl border-border/80 shadow-sm flex flex-col justify-between">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-5 text-emerald-600" /> กู้คืนข้อมูลจากไฟล์ (Restore JSON)
            </CardTitle>
            <CardDescription className="text-xs">
              นำเข้าไฟล์สำรองข้อมูลของระบบ โชห่วยยุค90s (.json) เพื่อกู้คืนสินค้าและประวัติการทำงาน
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 pt-1 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed border-border hover:border-emerald-500/70 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-muted/20 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10"
            >
              <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2">
                <FileJson className="size-6" />
              </div>
              <div className="text-xs font-semibold text-foreground">
                คลิกเพื่อเลือกไฟล์สำรองข้อมูล (.json)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                ระบบจะตรวจสอบความถูกต้องและความเข้ากันได้ของไฟล์ก่อนยืนยันการกู้คืน
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 text-xs font-semibold rounded-xl gap-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" /> เลือกไฟล์สำรองเพื่อกู้คืน...
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* DANGER ZONE */}
      <Card className="rounded-2xl border-destructive/30 bg-destructive/5 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <ShieldAlert className="size-5" /> เขตความปลอดภัยระดับสูง (Danger Zone)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            การดำเนินการในส่วนนี้ไม่สามารถย้อนกลับได้ ต้องใช้รหัส PIN ของ Admin หรือ Manager
            เท่านั้น
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-foreground">
              ล้างเฉพาะประวัติธุรกรรม (Clear Transactions Only)
            </div>
            <div className="text-muted-foreground text-[11px]">
              ล้างประวัติการรับเข้า-เบิกออก, PO, และคิวพิมพ์เอกสาร
              โดยข้อมูลสินค้าและหมวดหมู่ยังอยู่ครบ
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs shrink-0 gap-1.5"
            onClick={() => handleOpenDangerAction("CLEAR_TX")}
          >
            <RotateCcw className="size-3.5" /> ล้างประวัติธุรกรรม
          </Button>
        </CardContent>

        {/* Clear Mock Data for Real Store Production */}
        <div className="border-t border-destructive/20 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-destructive/10">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-destructive flex items-center gap-1.5">
              <span>ล้างข้อมูลทดลองทั้งหมด (เริ่มใช้งานข้อมูลจริง 100%)</span>
              <Badge variant="destructive" className="text-[10px]">
                แนะนำสำหรับใช้งานจริง
              </Badge>
            </div>
            <div className="text-muted-foreground text-[11px]">
              ล้างสินค้าตัวอย่าง, สต็อกทดลอง, PO และประวัติทั้งหมด
              เพื่อเริ่มต้นบันทึกสินค้าและข้อมูลจริงของร้าน (หมวดหมู่และหน่วยนับยังคงอยู่)
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-9 rounded-xl text-xs shrink-0 gap-1.5 font-semibold shadow-xs"
            onClick={() => handleOpenDangerAction("CLEAR_MOCK")}
          >
            <Trash2 className="size-3.5" /> ล้างข้อมูลทดลองทั้งหมด
          </Button>
        </div>

        <div className="border-t border-destructive/20 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-muted-foreground">
              คืนค่าเริ่มต้นจากโรงงาน (Factory Reset & Seed Demo Data)
            </div>
            <div className="text-muted-foreground text-[11px]">
              ล้างข้อมูลทั้งหมด และคืนค่ากลับสู่ชุดสินค้าตัวอย่างเริ่มต้นของร้าน โชห่วยยุค90s
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs shrink-0 gap-1.5 font-medium border-border"
            onClick={() => handleOpenDangerAction("FACTORY_RESET")}
          >
            <RotateCcw className="size-3.5" /> โหลดข้อมูลตัวอย่างใหม่
          </Button>
        </div>
      </Card>

      {/* RESTORE INSPECTION & CONFIRMATION MODAL */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <FileCheck className="size-5 text-emerald-600" />
              ตรวจสอบไฟล์สำรองข้อมูลก่อนกู้คืน
            </DialogTitle>
            <DialogDescription className="text-xs">
              ระบบตรวจสอบโครงสร้างไฟล์สำรองข้อมูลเรียบร้อยแล้ว
            </DialogDescription>
          </DialogHeader>

          {pendingBackup && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ชื่อร้าน / สาขา:</span>
                  <span className="font-semibold text-foreground">
                    {pendingBackup.metadata.storeName} ({pendingBackup.metadata.branchName})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันที่สำรองข้อมูล:</span>
                  <span className="font-mono text-primary font-medium">
                    {pendingBackup.metadata.createdAtThai}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ผู้จัดทำสำรอง:</span>
                  <span>{pendingBackup.metadata.exportedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">จำนวนสินค้าในไฟล์:</span>
                  <span className="font-mono font-bold text-foreground">
                    {pendingBackup.metadata.totalProducts} รายการ (
                    {pendingBackup.metadata.totalStockUnits.toLocaleString()} ชิ้น)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ใบสั่งซื้อ / รายการเคลื่อนไหว:</span>
                  <span className="font-mono">
                    {pendingBackup.metadata.totalOrders} PO /{" "}
                    {pendingBackup.metadata.totalMovements} รายการ
                  </span>
                </div>
              </div>

              {/* RESTORE MODE SELECTION */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">เลือกรูปแบบการกู้คืนข้อมูล:</Label>
                <RadioGroup
                  value={restoreMode}
                  onValueChange={(val: "OVERWRITE" | "MERGE") => setRestoreMode(val)}
                  className="space-y-2"
                >
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
                      restoreMode === "OVERWRITE"
                        ? "border-emerald-600/50 bg-emerald-500/10 font-semibold"
                        : "border-border"
                    }`}
                    onClick={() => setRestoreMode("OVERWRITE")}
                  >
                    <RadioGroupItem value="OVERWRITE" id="mode-overwrite" className="mt-0.5" />
                    <div>
                      <div className="text-xs text-foreground">
                        โหมดเขียนทับทั้งหมด (Overwrite Mode) - แนะนำ
                      </div>
                      <div className="text-[11px] text-muted-foreground font-normal">
                        ล้างข้อมูลปัจจุบันและแทนที่ด้วยข้อมูลจากไฟล์สำรองทั้งหมดอย่างแม่นยำ
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
                      restoreMode === "MERGE"
                        ? "border-emerald-600/50 bg-emerald-500/10 font-semibold"
                        : "border-border"
                    }`}
                    onClick={() => setRestoreMode("MERGE")}
                  >
                    <RadioGroupItem value="MERGE" id="mode-merge" className="mt-0.5" />
                    <div>
                      <div className="text-xs text-foreground">โหมดผสานข้อมูล (Merge Mode)</div>
                      <div className="text-[11px] text-muted-foreground font-normal">
                        เพิ่มเฉพาะสินค้าและหมวดหมู่ใหม่ที่ยังไม่มีในระบบ โดยไม่ลบสินค้าเดิม
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl"
              onClick={() => setRestoreModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-10 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmRestore}
            >
              ยืนยันการกู้คืนข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DANGER ACTION CONFIRMATION MODAL WITH PIN */}
      <Dialog open={dangerModalOpen} onOpenChange={setDangerModalOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />
              {dangerAction === "CLEAR_TX"
                ? "ยืนยันล้างประวัติธุรกรรม"
                : dangerAction === "CLEAR_MOCK"
                  ? "ยืนยันล้างข้อมูลทดลองทั้งหมด"
                  : "ยืนยันคืนค่าเริ่มต้นโรงงาน"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {dangerAction === "CLEAR_TX"
                ? "ประวัติการรับเข้า-เบิกออก, PO และคิวพิมพ์จะถูกล้างทั้งหมด (สินค้าคงเดิม)"
                : dangerAction === "CLEAR_MOCK"
                  ? "สินค้าตัวอย่าง, สต็อกทดลอง, PO และประวัติทั้งหมดจะถูกล้างออก เพื่อให้คุณเริ่มต้นบันทึกข้อมูลสินค้าจริงของร้าน"
                  : "ข้อมูลทั้งหมดจะถูกลบและแทนที่ด้วยชุดข้อมูลเริ่มต้นของ โชห่วยยุค90s"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">กรอกรหัส PIN ของ Admin เพื่อยืนยัน *</Label>
              <Input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="กรอก PIN เช่น 1234"
                className="h-11 text-center font-mono text-lg tracking-widest rounded-xl"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmDangerAction();
                }}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                (PIN เจ้าของร้านเริ่มต้น: 1234)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl"
              onClick={() => setDangerModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              className="h-10 text-xs font-semibold rounded-xl"
              onClick={handleConfirmDangerAction}
            >
              ยืนยันดำเนินการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
