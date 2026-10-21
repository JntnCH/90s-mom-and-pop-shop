import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileCode2,
  FileSpreadsheet,
  FolderTree,
  HardDrive,
  Info,
  Layers,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { StaffManagementTab } from "@/components/auth/StaffManagementTab";
import { FlexMessageVisualizer } from "@/components/line/FlexMessageVisualizer";
import { FlexSimulatorImporter } from "@/components/line/FlexSimulatorImporter";
import { BackupRestoreTab } from "@/components/settings/BackupRestoreTab";
import { GoogleSheetsSyncTab } from "@/components/sheets/GoogleSheetsSyncTab";
import { CategorySelect } from "@/components/master/MasterSelects";
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
import {
  createDailySummaryFlexBubble,
  createMiniAppPortalFlexBubble,
  createPurchaseOrderFlex,
  createPurchaseOrderFlexBubble,
  createStockAlertFlexBubble,
  DEFAULT_STORE_NAME,
  getSystemStoreName,
} from "@/lib/flex-templates";
import { getLatestPurchaseOrderFlexMessage } from "@/lib/flex-templates/flex-simulator-json";
import {
  getLineFollowersHistoryFn,
  getLineServerConfigFn,
  registerLineFollowerFn,
  sendMiniAppPortalCardFn,
  syncLineFollowersFn,
  syncMasterDatabaseFn,
} from "@/lib/line-server-fn";
import {
  getClientLiffId,
  getLineStatus,
  setClientLiffId,
  shareFlexViaLiffPicker,
  type LineConfigStatus,
} from "@/lib/line-service";
import {
  MasterStore,
  type CategoryItem,
  type LineUserFollower,
  type ProductItem,
  type SubCategoryItem,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";
import { toast } from "sonner";
import { PrinterService } from "@/lib/printer-service";
import {
  generateCategoryCode,
  getCategoryCodeSuggestions,
  autoFillMissingCategoryCodes,
} from "@/lib/category-code-generator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isUnitItem(value: unknown): value is UnitItem {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["shortName"] === "string"
  );
}

function isCategoryItem(value: unknown): value is CategoryItem {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["code"] === "string"
  );
}

function isSubCategoryItem(value: unknown): value is SubCategoryItem {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["categoryId"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["code"] === "string"
  );
}

function isZoneItem(value: unknown): value is ZoneItem {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["code"] === "string" &&
    isOptionalString(value["description"])
  );
}

function isProductItem(value: unknown): value is ProductItem {
  if (!isRecord(value)) return false;
  const codeType = value["codeType"];
  return (
    typeof value["id"] === "string" &&
    typeof value["sku"] === "string" &&
    typeof value["barcode"] === "string" &&
    (codeType === "QR" || codeType === "Barcode") &&
    isOptionalString(value["format"]) &&
    typeof value["name"] === "string" &&
    isOptionalString(value["imageUrl"]) &&
    typeof value["categoryId"] === "string" &&
    isOptionalString(value["subCategoryId"]) &&
    isOptionalString(value["zoneId"]) &&
    typeof value["unitId"] === "string" &&
    typeof value["costPrice"] === "number" &&
    typeof value["sellPrice"] === "number" &&
    typeof value["stock"] === "number" &&
    typeof value["minStock"] === "number" &&
    typeof value["targetStock"] === "number" &&
    typeof value["reorderQuantity"] === "number" &&
    typeof value["isActive"] === "boolean" &&
    typeof value["createdAt"] === "string" &&
    typeof value["updatedAt"] === "string"
  );
}

function isLineUserFollower(value: unknown): value is LineUserFollower {
  if (!isRecord(value)) return false;
  const role = value["role"];
  return (
    typeof value["userId"] === "string" &&
    typeof value["displayName"] === "string" &&
    isOptionalString(value["pictureUrl"]) &&
    isOptionalString(value["statusMessage"]) &&
    typeof value["followedAt"] === "string" &&
    typeof value["lastInteractionAt"] === "string" &&
    (role === "admin" || role === "staff" || role === "viewer")
  );
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ & ฐานข้อมูล | โชห่วยยุค90s" },
      {
        name: "description",
        content:
          "จัดการโซนสินค้า หมวดหมู่ หน่วยนับ ผู้ใช้งานและผู้ติดตาม LINE Bot, User ID และแม่แบบ Flex Message",
      },
      { property: "og:title", content: "ตั้งค่าระบบ & ฐานข้อมูล | โชห่วยยุค90s" },
      {
        property: "og:description",
        content: "จัดการข้อมูลหลักและการเชื่อมต่อ LINE พร้อมฐานข้อมูลผู้ใช้งาน",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("followers");
  const [storeName, setStoreName] = useState(() => getSystemStoreName());

  // Zone State
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneItem | null>(null);
  const [zoneForm, setZoneForm] = useState({ name: "", code: "", description: "" });

  // Category State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [catForm, setCatForm] = useState({ name: "", code: "" });
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

  // Subcategory State
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([]);
  const [subCategoryModalOpen, setSubCategoryModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategoryItem | null>(null);
  const [subCategoryForm, setSubCategoryForm] = useState({ categoryId: "", name: "", code: "" });
  const [isSubCategoryCodeManuallyEdited, setIsSubCategoryCodeManuallyEdited] = useState(false);
  const pendingDeletedSubCategoryIds = useRef<string[]>([]);

  // Unit State
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [unitForm, setUnitForm] = useState({ name: "", shortName: "" });

  // Followers & Users State (ข้อมูลผู้ใช้งาน / ผู้ติดตาม LINE Bot / User ID)
  const [followers, setFollowers] = useState<LineUserFollower[]>([]);
  const [followerModalOpen, setFollowerModalOpen] = useState(false);
  const [editingFollower, setEditingFollower] = useState<LineUserFollower | null>(null);
  const [followerForm, setFollowerForm] = useState<{
    userId: string;
    displayName: string;
    pictureUrl: string;
    statusMessage: string;
    role: "admin" | "staff" | "viewer";
  }>({
    userId: "",
    displayName: "",
    pictureUrl: "",
    statusMessage: "",
    role: "staff",
  });
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Flex Preview Modal State
  const [previewFlexModalOpen, setPreviewFlexModalOpen] = useState(false);
  const [previewFlexTitle, setPreviewFlexTitle] = useState("");
  const [previewFlexJson, setPreviewFlexJson] = useState<unknown>(null);

  // LINE Status
  const [lineStatus, setLineStatus] = useState<LineConfigStatus | null>(null);
  const [serverLineConfig, setServerLineConfig] = useState<{
    hasChannelId: boolean;
    hasChannelSecret: boolean;
    hasAccessToken: boolean;
    hasServerLiffId: boolean;
  } | null>(null);

  const clientLiffId = getClientLiffId();

  const reloadData = useCallback(() => {
    setZones(MasterStore.getZones());
    setCategories(MasterStore.getCategories());
    setSubCategories(MasterStore.getSubCategories());
    setUnits(MasterStore.getUnits());
    setFollowers(MasterStore.getFollowers());
  }, []);

  const handleSaveStoreName = () => {
    const trimmedName = storeName.trim();
    if (!trimmedName) {
      toast.error("กรุณาระบุชื่อร้าน");
      return;
    }
    const updated = PrinterService.saveReceiptConfig({ storeName: trimmedName });
    setStoreName(updated.storeName);
    toast.success("บันทึกชื่อร้านเรียบร้อย");
  };

  const syncWithCentralServer = useCallback(async (syncLiveLineFollowers = false) => {
    setIsSyncing(true);
    let lineSyncError = "";
    let lineSyncCount = 0;
    const deletedSubCategoryIds = pendingDeletedSubCategoryIds.current;
    try {
      if (syncLiveLineFollowers) {
        const lineResult = await syncLineFollowersFn();
        if (lineResult.success) {
          lineSyncCount = lineResult.count;
          const mergedFollowers = new Map(
            MasterStore.getFollowers().map((follower) => [follower.userId, follower]),
          );
          lineResult.followers.forEach((follower) => {
            const savedFollower = mergedFollowers.get(follower.userId);
            mergedFollowers.set(follower.userId, {
              ...savedFollower,
              ...follower,
              pictureUrl: follower.pictureUrl ?? undefined,
              statusMessage: follower.statusMessage ?? undefined,
              role: savedFollower?.role ?? "viewer",
            });
          });
          const followerList = [...mergedFollowers.values()];
          MasterStore.saveFollowers(followerList);
          setFollowers(followerList);
        } else {
          lineSyncError = lineResult.message;
        }
      }

      const res = await syncMasterDatabaseFn({
        data: {
          products: MasterStore.getProducts(),
          categories: MasterStore.getCategories(),
          subCategories: MasterStore.getSubCategories(),
          ...(deletedSubCategoryIds.length > 0 ? { deletedSubCategoryIds } : {}),
          zones: MasterStore.getZones(),
          units: MasterStore.getUnits(),
          receives: MasterStore.getReceives(),
          followers: MasterStore.getFollowers(),
          movements: MasterStore.getMovements(),
          purchaseOrders: MasterStore.getPurchaseOrders(),
        },
      });

      if (isRecord(res) && res["success"] === true && isRecord(res["data"])) {
        pendingDeletedSubCategoryIds.current = pendingDeletedSubCategoryIds.current.filter(
          (id) => !deletedSubCategoryIds.includes(id),
        );
        const data = res["data"];
        const syncedUnits = data["units"];
        const syncedCategories = data["categories"];
        const syncedSubCategories = data["subCategories"];
        const syncedZones = data["zones"];
        const syncedProducts = data["products"];
        const syncedFollowers = data["followers"];

        if (isArrayOf(syncedUnits, isUnitItem) && syncedUnits.length > 0) {
          MasterStore.saveUnits(syncedUnits);
          setUnits(syncedUnits);
        }
        if (isArrayOf(syncedCategories, isCategoryItem) && syncedCategories.length > 0) {
          MasterStore.saveCategories(syncedCategories);
          setCategories(syncedCategories);
        }
        if (isArrayOf(syncedSubCategories, isSubCategoryItem)) {
          MasterStore.saveSubCategories(syncedSubCategories);
          setSubCategories(syncedSubCategories);
        }
        if (isArrayOf(syncedZones, isZoneItem) && syncedZones.length > 0) {
          MasterStore.saveZones(syncedZones);
          setZones(syncedZones);
        }
        if (isArrayOf(syncedProducts, isProductItem) && syncedProducts.length > 0) {
          MasterStore.saveProducts(syncedProducts);
        }
        if (isArrayOf(syncedFollowers, isLineUserFollower) && syncedFollowers.length > 0) {
          setFollowers(syncedFollowers);
        }
        setSyncStatusMsg(
          lineSyncError ||
            (syncLiveLineFollowers
              ? `ซิงค์ผู้ติดตาม LINE OA สำเร็จ ${lineSyncCount} รายการ`
              : "ข้อมูลประสานตรงกันเรียบร้อยแล้ว (All Data Synchronized)"),
        );
        setTimeout(() => setSyncStatusMsg(""), 4000);
      }
    } catch (err) {
      console.error("Sync error", err);
      setSyncStatusMsg(lineSyncError || "ซิงค์ข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
    getLineStatus().then(setLineStatus);
    getLineServerConfigFn()
      .then(setServerLineConfig)
      .catch(() => setServerLineConfig(null));

    // Try background sync with server
    syncWithCentralServer();

    const onStoreChange = () => reloadData();
    window.addEventListener("minimark_store_change", onStoreChange);
    return () => window.removeEventListener("minimark_store_change", onStoreChange);
  }, [reloadData, syncWithCentralServer]);

  // Zone CRUD
  const handleSaveZone = () => {
    if (!zoneForm.name.trim()) return;
    if (editingZone) {
      MasterStore.updateZone(editingZone.id, zoneForm);
    } else {
      MasterStore.addZone(zoneForm);
    }
    setZoneModalOpen(false);
    setEditingZone(null);
    setZoneForm({ name: "", code: "", description: "" });
    void syncWithCentralServer();
  };

  const handleEditZone = (item: ZoneItem) => {
    setEditingZone(item);
    setZoneForm({
      name: item.name,
      code: item.code || "",
      description: item.description || "",
    });
    setZoneModalOpen(true);
  };

  const handleDeleteZone = (id: string) => {
    if (confirm("ต้องการลบโซนสินค้านี้ใช่หรือไม่?")) {
      MasterStore.deleteZone(id);
      void syncWithCentralServer();
    }
  };

  // Category CRUD
  const handleSaveCategory = () => {
    if (!catForm.name.trim()) return;
    const cleanCode = catForm.code.trim();
    const finalCode =
      cleanCode && cleanCode !== "-" && cleanCode !== "—"
        ? cleanCode.toUpperCase()
        : generateCategoryCode(catForm.name, categories, editingCat?.id);

    if (editingCat) {
      MasterStore.updateCategory(editingCat.id, { name: catForm.name.trim(), code: finalCode });
      toast.success(`อัปเดตหมวดหมู่ "${catForm.name.trim()}" (รหัส: ${finalCode}) เรียบร้อย`);
    } else {
      MasterStore.addCategory({ name: catForm.name.trim(), code: finalCode });
      toast.success(`เพิ่มหมวดหมู่ "${catForm.name.trim()}" (รหัส: ${finalCode}) สำเร็จ`);
    }
    setCatModalOpen(false);
    setEditingCat(null);
    setCatForm({ name: "", code: "" });
    setIsCodeManuallyEdited(false);
    reloadData();
    void syncWithCentralServer();
  };

  const handleOpenAddCategory = () => {
    setEditingCat(null);
    setIsCodeManuallyEdited(false);
    setCatForm({ name: "", code: "" });
    setCatModalOpen(true);
  };

  const handleEditCategory = (item: CategoryItem) => {
    setEditingCat(item);
    const hasValidCode = Boolean(item.code && item.code !== "-" && item.code !== "—");
    setIsCodeManuallyEdited(hasValidCode);
    // If category didn't have a code yet, auto-suggest standard code immediately
    const effectiveCode = hasValidCode
      ? item.code
      : generateCategoryCode(item.name, categories, item.id);
    setCatForm({ name: item.name, code: effectiveCode });
    setCatModalOpen(true);
  };

  const handleCategoryNameChange = (name: string) => {
    if (!isCodeManuallyEdited) {
      const autoCode = generateCategoryCode(name, categories, editingCat?.id);
      setCatForm({ name, code: autoCode });
    } else {
      setCatForm((prev) => ({ ...prev, name }));
    }
  };

  const handleCategoryCodeChange = (code: string) => {
    setIsCodeManuallyEdited(true);
    setCatForm((prev) => ({ ...prev, code: code.toUpperCase() }));
  };

  const handleRegenerateCategoryCode = () => {
    const autoCode = generateCategoryCode(catForm.name, categories, editingCat?.id);
    setIsCodeManuallyEdited(false);
    setCatForm((prev) => ({ ...prev, code: autoCode }));
    toast.success(`สร้างรหัส ${autoCode} ให้อัตโนมัติ`);
  };

  const handleDeleteCategory = (id: string) => {
    if (subCategories.some((item) => item.categoryId === id)) {
      toast.error("ลบหมวดหมู่หลักไม่ได้ เนื่องจากยังมีหมวดหมู่ย่อยผูกอยู่");
      return;
    }
    if (confirm("ต้องการลบหมวดหมู่นี้ใช่หรือไม่?")) {
      MasterStore.deleteCategory(id);
      reloadData();
      void syncWithCentralServer();
    }
  };

  // Subcategory CRUD
  const handleOpenAddSubCategory = () => {
    setEditingSubCategory(null);
    setIsSubCategoryCodeManuallyEdited(false);
    setSubCategoryForm({ categoryId: categories[0]?.id || "", name: "", code: "" });
    setSubCategoryModalOpen(true);
  };

  const handleEditSubCategory = (item: SubCategoryItem) => {
    setEditingSubCategory(item);
    setIsSubCategoryCodeManuallyEdited(true);
    setSubCategoryForm({ categoryId: item.categoryId, name: item.name, code: item.code });
    setSubCategoryModalOpen(true);
  };

  const handleSubCategoryNameChange = (name: string) => {
    if (!isSubCategoryCodeManuallyEdited) {
      const code = generateCategoryCode(name, subCategories, editingSubCategory?.id);
      setSubCategoryForm((previous) => ({ ...previous, name, code }));
      return;
    }
    setSubCategoryForm((previous) => ({ ...previous, name }));
  };

  const handleSaveSubCategory = () => {
    const name = subCategoryForm.name.trim();
    const categoryId = subCategoryForm.categoryId;
    if (!name || !categoryId) return;

    const duplicateName = subCategories.some(
      (item) =>
        item.id !== editingSubCategory?.id &&
        item.categoryId === categoryId &&
        item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicateName) {
      toast.error("หมวดหมู่ย่อยชื่อนี้มีอยู่แล้วในหมวดหมู่หลักนี้");
      return;
    }

    if (
      editingSubCategory &&
      editingSubCategory.categoryId !== categoryId &&
      MasterStore.getProducts().some((product) => product.subCategoryId === editingSubCategory.id)
    ) {
      toast.error("ย้ายหมวดหมู่หลักไม่ได้ เนื่องจากมีสินค้าใช้หมวดหมู่ย่อยนี้อยู่");
      return;
    }

    const cleanCode = subCategoryForm.code.trim();
    const code =
      cleanCode && cleanCode !== "-" && cleanCode !== "—"
        ? cleanCode.toUpperCase()
        : generateCategoryCode(name, subCategories, editingSubCategory?.id);
    const duplicateCode = subCategories.some(
      (item) =>
        item.id !== editingSubCategory?.id &&
        item.categoryId === categoryId &&
        item.code.trim().toUpperCase() === code,
    );
    if (duplicateCode) {
      toast.error("รหัสหมวดหมู่ย่อยนี้ถูกใช้แล้วในหมวดหมู่หลักนี้");
      return;
    }

    const updates = { categoryId, name, code };
    if (editingSubCategory) {
      MasterStore.updateSubCategory(editingSubCategory.id, updates);
      toast.success(`อัปเดตหมวดหมู่ย่อย “${name}” เรียบร้อย`);
    } else {
      MasterStore.addSubCategory(updates);
      toast.success(`เพิ่มหมวดหมู่ย่อย “${name}” สำเร็จ`);
    }
    setSubCategoryModalOpen(false);
    setEditingSubCategory(null);
    setSubCategoryForm({ categoryId: categories[0]?.id || "", name: "", code: "" });
    setIsSubCategoryCodeManuallyEdited(false);
    reloadData();
    void syncWithCentralServer();
  };

  const handleDeleteSubCategory = (id: string) => {
    if (MasterStore.getProducts().some((product) => product.subCategoryId === id)) {
      toast.error("ลบไม่ได้ เนื่องจากมีสินค้าใช้หมวดหมู่ย่อยนี้อยู่ กรุณาแก้ข้อมูลสินค้าก่อน");
      return;
    }
    if (!confirm("ต้องการลบหมวดหมู่ย่อยนี้ใช่หรือไม่?")) return;

    MasterStore.deleteSubCategory(id);
    reloadData();
    pendingDeletedSubCategoryIds.current = [...pendingDeletedSubCategoryIds.current, id];
    void syncWithCentralServer();
  };

  const missingCategoryCodeCount = categories.filter(
    (c) => !c.code || c.code.trim() === "" || c.code.trim() === "-" || c.code.trim() === "—",
  ).length;

  const handleAutoFillAllMissingCodes = () => {
    const { updated, fixedCount } = autoFillMissingCategoryCodes(categories);
    if (fixedCount === 0) {
      toast.info("หมวดหมู่ทุกรายการมีรหัสเรียบร้อยแล้ว");
      return;
    }
    MasterStore.saveCategories(updated as CategoryItem[]);
    setCategories(updated as CategoryItem[]);
    toast.success(`สร้างรหัสหมวดหมู่อัตโนมัติสำเร็จ ${fixedCount} รายการเรียบร้อยแล้ว`);
    reloadData();
    void syncWithCentralServer();
  };

  // Unit CRUD
  const handleSaveUnit = () => {
    if (!unitForm.name.trim()) return;
    if (editingUnit) {
      MasterStore.updateUnit(editingUnit.id, unitForm);
    } else {
      MasterStore.addUnit(unitForm);
    }
    setUnitModalOpen(false);
    setEditingUnit(null);
    setUnitForm({ name: "", shortName: "" });
    void syncWithCentralServer();
  };

  const handleEditUnit = (item: UnitItem) => {
    setEditingUnit(item);
    setUnitForm({ name: item.name, shortName: item.shortName || "" });
    setUnitModalOpen(true);
  };

  const handleDeleteUnit = (id: string) => {
    if (confirm("ต้องการลบหน่วยนับนี้ใช่หรือไม่?")) {
      MasterStore.deleteUnit(id);
      void syncWithCentralServer();
    }
  };

  // Follower / User ID CRUD & Register
  const handleOpenAddFollower = () => {
    setEditingFollower(null);
    setFollowerForm({
      userId: "",
      displayName: "",
      pictureUrl: "",
      statusMessage: "",
      role: "staff",
    });
    setFollowerModalOpen(true);
  };

  const handleEditFollower = (follower: LineUserFollower) => {
    setEditingFollower(follower);
    setFollowerForm({
      userId: follower.userId,
      displayName: follower.displayName,
      pictureUrl: follower.pictureUrl || "",
      statusMessage: follower.statusMessage || "",
      role: follower.role || "staff",
    });
    setFollowerModalOpen(true);
  };

  const handleSaveFollower = async () => {
    if (!followerForm.displayName.trim() || !followerForm.userId.trim()) return;

    const timeStr =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    const userPayload: LineUserFollower = {
      userId: followerForm.userId.trim(),
      displayName: followerForm.displayName.trim(),
      pictureUrl: followerForm.pictureUrl.trim() || undefined,
      statusMessage: followerForm.statusMessage.trim() || undefined,
      followedAt: editingFollower?.followedAt || timeStr,
      lastInteractionAt: timeStr,
      role: followerForm.role,
    };

    MasterStore.saveFollower(userPayload);

    try {
      await registerLineFollowerFn({ data: userPayload });
    } catch (e) {
      console.warn("Could not save to server directly", e);
    }

    setFollowerModalOpen(false);
    reloadData();
  };

  // Flex Previews
  const handlePreviewPOFlex = () => {
    try {
      setPreviewFlexTitle("ใบสั่งซื้อสินค้า (JSON ล่าสุดจาก LINE Simulator)");
      setPreviewFlexJson(getLatestPurchaseOrderFlexMessage());
      setPreviewFlexModalOpen(true);
    } catch {
      const carousel = createPurchaseOrderFlex(
        [
          {
            name: "มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง",
            quantity: 30,
            unitName: "ซอง",
            costPrice: 6.0,
          },
          {
            name: "โค้ก น้ำอัดลม ออริจินัล 325ml",
            quantity: 48,
            unitName: "กระป๋อง",
            costPrice: 12.0,
          },
          {
            name: "เลย์ มันฝรั่งทอดกรอบ รสคลาสสิค",
            quantity: 20,
            unitName: "ซอง",
            costPrice: 17.5,
          },
        ],
        {
          storeName: getSystemStoreName(),
          note: "ใบสั่งซื้อสินค้าประจำวัน",
          containerType: "carousel",
          groupBy: "category_no_header",
          showGroupHeaders: false,
        },
      );
      setPreviewFlexTitle("ใบสั่งซื้อสินค้า (purchase-order-flex.ts)");
      setPreviewFlexJson(carousel);
      setPreviewFlexModalOpen(true);
    }
  };

  const handlePreviewStockAlertFlex = () => {
    const bubble = createStockAlertFlexBubble(
      [
        {
          name: "น้ำดื่มคริสตัล 600ml",
          stock: 3,
          minStock: 10,
          unitName: "แพ็ค",
          status: "LOW_STOCK",
        },
        {
          name: "บรีส เอกเซล ผงซักฟอก 750g",
          stock: 0,
          minStock: 8,
          unitName: "ซอง",
          status: "OUT_OF_STOCK",
        },
      ],
      { storeName: getSystemStoreName(), title: "แจ้งเตือนสินค้าใกล้หมด / หมดสต็อก" },
    );
    setPreviewFlexTitle("แจ้งเตือนสินค้าสต็อกต่ำ (stock-alert-flex.ts)");
    setPreviewFlexJson(bubble);
    setPreviewFlexModalOpen(true);
  };

  const handlePreviewDailySummaryFlex = () => {
    const bubble = createDailySummaryFlexBubble(
      {
        totalProducts: 5,
        inStockCount: 3,
        lowStockCount: 2,
        outOfStockCount: 0,
        totalEstimatedCost: 1450.0,
        reorderCount: 2,
      },
      { storeName: getSystemStoreName() },
    );
    setPreviewFlexTitle("สรุปยอดสต็อกประจำวัน (daily-summary-flex.ts)");
    setPreviewFlexJson(bubble);
    setPreviewFlexModalOpen(true);
  };

  // LINE Portal Test Send & Copy State
  const [portalSending, setPortalSending] = useState(false);
  const [portalStatusMsg, setPortalStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Local LIFF ID state for editing in Settings
  const [editingLiffId, setEditingLiffId] = useState<string>(
    () => clientLiffId || "2011710264-gaZ7oEcK",
  );
  const [, setClientLiffIdState] = useState(() => clientLiffId);

  const handleSaveLiffId = () => {
    const trimmed = editingLiffId.trim();
    if (!trimmed) {
      toast.error("กรุณาระบุ LINE LIFF ID");
      return;
    }
    setClientLiffId(trimmed);
    setClientLiffIdState(trimmed);
    toast.success("บันทึก LINE LIFF ID สำเร็จ");
  };

  const handleTestOpenLiffPicker = async () => {
    const liffId = clientLiffId || editingLiffId.trim();
    if (!liffId) {
      toast.error("กรุณาระบุและบันทึก LINE LIFF ID ก่อนทดสอบ");
      return;
    }
    const bubble = createMiniAppPortalFlexBubble({
      storeName: getSystemStoreName(),
      liffId,
    });
    const res = await shareFlexViaLiffPicker(bubble, "ทดสอบส่งการ์ด Flex Message ผ่าน LIFF");
    if (res.success) {
      toast.success("ส่ง LINE Flex Message สำเร็จเรียบร้อย");
    } else {
      toast.error(res.message);
    }
  };

  const handleCopyLink = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handlePreviewPortalFlex = () => {
    const liffId = clientLiffId || "2007000000-xxxxxx";
    const bubble = createMiniAppPortalFlexBubble({
      storeName: getSystemStoreName(),
      liffId,
    });
    setPreviewFlexTitle("การ์ดทางเข้า Mini App (mini-app-portal-flex.ts)");
    setPreviewFlexJson(bubble);
    setPreviewFlexModalOpen(true);
  };

  const handleSendPortalCard = async (targetUserId?: string, isBroadcast: boolean = false) => {
    setPortalSending(true);
    setPortalStatusMsg(null);
    try {
      const res = await sendMiniAppPortalCardFn({
        data: {
          toUserId: targetUserId,
          isBroadcast,
          storeName: getSystemStoreName(),
          liffId: clientLiffId || undefined,
        },
      });

      if (res.success) {
        setPortalStatusMsg({
          type: "success",
          text: isBroadcast
            ? "บรอดแคสต์การ์ดทางเข้า Mini App ไปยังทุกคนใน LINE สำเร็จเรียบร้อย"
            : `ส่งการ์ดทางเข้า Mini App ไปยัง LINE สำเร็จเรียบร้อย`,
        });
      } else {
        setPortalStatusMsg({
          type: "error",
          text: res.error || "ไม่สามารถส่งการ์ดทางเข้า Mini App ได้",
        });
      }
    } catch (err) {
      setPortalStatusMsg({
        type: "error",
        text: `Error: ${String(err)}`,
      });
    } finally {
      setPortalSending(false);
    }
  };

  return (
    <PermissionGuard
      permission="canAccessSettings"
      fallbackTitle="เฉพาะผู้จัดการและเจ้าของร้านเท่านั้น"
      fallbackDescription="เมนูตั้งค่าระบบและการจัดการข้อมูลหลักสงวนสิทธิ์เฉพาะระดับผู้จัดการสาขา (Manager) หรือเจ้าของร้าน (Admin)"
    >
      <div className="space-y-4 sm:space-y-6 pb-12">
        <PageHeader
          title="ตั้งค่าระบบ & ฐานข้อมูล"
          description="จัดการข้อมูลหลัก โซนสินค้า หมวดหมู่ หมวดหมู่ย่อย หน่วยนับ ผู้ใช้งาน/ผู้ติดตาม LINE Bot และแม่แบบ Flex Message"
        />

        {syncStatusMsg ? (
          <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded-2xl">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle className="font-semibold text-sm">การเชื่อมต่อฐานข้อมูล</AlertTitle>
            <AlertDescription className="text-xs">{syncStatusMsg}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="size-4 text-primary" /> ชื่อร้านของระบบ
            </CardTitle>
            <CardDescription className="text-xs">
              ชื่อนี้จะแสดงในเมนูหลัก ใบเสร็จ เอกสาร และข้อความที่ส่งผ่าน LINE
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Input
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="เช่น โชห่วยยุค90s"
              className="h-10 bg-background"
              maxLength={80}
            />
            <Button onClick={handleSaveStoreName} className="h-10 shrink-0 gap-1.5">
              <Check className="size-4" /> บันทึกชื่อร้าน
            </Button>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Responsive Mobile Tabs Grid */}
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto p-1.5 rounded-2xl bg-muted gap-1">
            <TabsTrigger
              value="sheets"
              className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" /> Google Sheets
            </TabsTrigger>
            <TabsTrigger
              value="rbac"
              className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
            >
              <ShieldCheck className="size-4 text-emerald-600" /> พนักงาน & สิทธิ์
            </TabsTrigger>
            <TabsTrigger
              value="backup"
              className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
            >
              <HardDrive className="size-4 text-amber-600" /> สำรอง & กู้คืน
            </TabsTrigger>
            <TabsTrigger
              value="followers"
              className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
            >
              <Users className="size-4 text-primary" /> ผู้ใช้งาน & Bot
            </TabsTrigger>
            <TabsTrigger
              value="flex"
              className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl font-medium"
            >
              <FileCode2 className="size-4 text-emerald-600" /> Flex Message
            </TabsTrigger>
            <TabsTrigger value="zones" className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl">
              <Layers className="size-4" /> โซนสินค้า
            </TabsTrigger>
            <TabsTrigger value="categories" className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl">
              <FolderTree className="size-4" /> หมวดหมู่
            </TabsTrigger>
            <TabsTrigger
              value="subcategories"
              className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl"
            >
              <FolderTree className="size-4" /> หมวดหมู่ย่อย
            </TabsTrigger>
            <TabsTrigger value="units" className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl">
              <Scale className="size-4" /> หน่วยนับ
            </TabsTrigger>
            <TabsTrigger value="line" className="h-10 text-xs sm:text-sm gap-1.5 rounded-xl">
              <MessageSquare className="size-4" /> LINE API
            </TabsTrigger>
          </TabsList>

          {/* TAB: GOOGLE SHEETS SYNC & WORKSPACE INTEGRATION */}
          <TabsContent value="sheets" className="space-y-4">
            <GoogleSheetsSyncTab />
          </TabsContent>

          {/* TAB: BACKUP & RESTORE (PHASE 12) */}
          <TabsContent value="backup" className="space-y-4">
            <BackupRestoreTab />
          </TabsContent>

          {/* TAB: STAFF & RBAC PERMISSIONS (PHASE 11) */}
          <TabsContent value="rbac" className="space-y-4">
            <StaffManagementTab />
          </TabsContent>

          {/* TAB 1: FOLLOWERS & BOT USERS / USER IDs */}
          <TabsContent value="followers" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="size-5 text-primary" /> ประวัติผู้ใช้งาน & ผู้เพิ่มเพื่อน LINE
                  Bot (User ID)
                </h2>
                <p className="text-xs text-muted-foreground">
                  รายชื่อที่บันทึกไว้ในระบบ พร้อม LINE User ID และสิทธิ์การใช้งาน
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  ซิงค์ผู้ติดตาม LINE OA จริงได้เมื่อมี Channel Access Token และบัญชี
                  Verified/Premium; กลุ่มแชตต้องเพิ่มด้วย Group ID
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs gap-1.5 rounded-xl"
                  onClick={() => void syncWithCentralServer(true)}
                  disabled={isSyncing}
                >
                  <RefreshCw
                    className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
                  />
                  {isSyncing ? "กำลังซิงค์..." : "ซิงค์ LINE จริง"}
                </Button>
                <Button
                  className="h-10 font-semibold gap-1.5 rounded-xl active:scale-95 shadow-sm"
                  onClick={handleOpenAddFollower}
                >
                  <UserPlus className="size-4" /> เพิ่มผู้ใช้งาน / User ID
                </Button>
              </div>
            </div>

            {/* Followers Cards for Mobile */}
            <div className="block md:hidden space-y-2.5">
              {followers.length === 0 ? (
                <Card className="rounded-2xl p-6 text-center text-muted-foreground">
                  <Users className="size-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">ยังไม่มีบัญชี LINE ที่บันทึกไว้</p>
                  <p className="mt-1 text-xs">เพิ่มด้วย User ID หรือ Group ID ที่ตรวจสอบแล้ว</p>
                </Card>
              ) : (
                followers.map((u) => (
                  <div
                    key={u.userId}
                    className="rounded-2xl border bg-card p-3.5 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-10 rounded-full border bg-muted/60 overflow-hidden shrink-0 flex items-center justify-center">
                          {u.pictureUrl ? (
                            <img
                              src={u.pictureUrl}
                              alt={u.displayName}
                              className="size-full object-cover"
                            />
                          ) : (
                            <Users className="size-5 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-foreground truncate">
                            {u.displayName}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground truncate">
                            {u.userId}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                        className="text-[10px] capitalize"
                      >
                        {u.role}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      <span>เพิ่มเพื่อน: {u.followedAt}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary"
                        onClick={() => handleEditFollower(u)}
                      >
                        <Pencil className="size-3 mr-1" /> แก้ไข
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table for Followers */}
            <Card className="hidden md:block rounded-2xl">
              <CardContent className="pt-4">
                <div className="rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">โปรไฟล์</TableHead>
                        <TableHead className="w-48">ชื่อผู้ใช้งาน (Display Name)</TableHead>
                        <TableHead className="w-64">LINE User ID</TableHead>
                        <TableHead className="w-28">สิทธิ์การใช้งาน</TableHead>
                        <TableHead>วันเวลาที่เพิ่มเพื่อน</TableHead>
                        <TableHead>ปฏิสัมพันธ์ล่าสุด</TableHead>
                        <TableHead className="w-20 text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            ยังไม่มีบัญชี LINE ที่บันทึกไว้
                          </TableCell>
                        </TableRow>
                      ) : (
                        followers.map((u) => (
                          <TableRow key={u.userId}>
                            <TableCell>
                              <div className="size-9 rounded-full border bg-muted/60 overflow-hidden flex items-center justify-center">
                                {u.pictureUrl ? (
                                  <img
                                    src={u.pictureUrl}
                                    alt={u.displayName}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <Users className="size-4 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">
                              {u.displayName}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {u.userId}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={u.role === "admin" ? "default" : "secondary"}
                                className="capitalize"
                              >
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.followedAt || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.lastInteractionAt || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditFollower(u)}
                              >
                                <Pencil className="size-4" />
                              </Button>
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

          {/* TAB 2: FLEX MESSAGE TEMPLATES & SIMULATOR IMPORTER */}
          <TabsContent value="flex" className="space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <FileCode2 className="size-5 text-emerald-600" /> แม่แบบ Flex Message & วาง JSON จาก
                LINE Simulator
              </h2>
              <p className="text-xs text-muted-foreground">
                ปรับแต่งหน้าตา Flex Message ด้วยตนเอง นำเข้า JSON จาก LINE Flex Simulator
                หรือเลือกใช้แม่แบบมาตรฐานของระบบ
              </p>
            </div>

            {/* Playground: Paste JSON from LINE Simulator */}
            <FlexSimulatorImporter />

            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="size-4 text-primary" /> แม่แบบมาตรฐานของระบบ (System Decoupled
                Templates)
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Purchase Order */}
                <Card className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs hover:border-emerald-500/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-600 text-white text-xs">ใบสั่งซื้อสินค้า</Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      purchase-order-flex.ts
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">ใบสั่งซื้อสินค้าประจำวัน</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      แยกคอลัมน์ [รายการ] [จำนวน] [หน่วยนับ] ออกจากกันชัดเจน พร้อมข้อความขนาดใหญ่
                      อ่านง่ายสบายตา
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"
                    onClick={handlePreviewPOFlex}
                  >
                    <Eye className="size-3.5" /> ดูตัวอย่าง Flex Message
                  </Button>
                </Card>

                {/* Card 2: Stock Alert */}
                <Card className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs hover:border-destructive/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-xs">
                      แจ้งเตือนสต็อก
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      stock-alert-flex.ts
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      แจ้งเตือนสินค้าใกล้หมด / หมด
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      เน้นสถานะความเร่งด่วน พร้อมแสดงจำนวนที่ต้องเติมสต็อกหน้าร้าน
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs gap-1.5 font-semibold text-destructive"
                    onClick={handlePreviewStockAlertFlex}
                  >
                    <Eye className="size-3.5" /> ดูตัวอย่าง Flex Message
                  </Button>
                </Card>

                {/* Card 3: Daily Summary */}
                <Card className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs hover:border-blue-500/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-blue-600 text-white text-xs">สรุปสต็อกรายวัน</Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      daily-summary-flex.ts
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">รายงานภาพรวมสต็อกประจำวัน</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      สรุปสินค้าพร้อมจำหน่าย, สินค้าใกล้หมด, สินค้าหมด และมูลค่าสต็อกคงเหลือ
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs gap-1.5 font-semibold text-blue-600 dark:text-blue-400"
                    onClick={handlePreviewDailySummaryFlex}
                  >
                    <Eye className="size-3.5" /> ดูตัวอย่าง Flex Message
                  </Button>
                </Card>

                {/* Card 4: Mini App Portal Card */}
                <Card className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs hover:border-[#06C755] transition-colors">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-[#06C755] text-white text-xs">ทางเข้า Mini App</Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      mini-app-portal-flex.ts
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">การ์ดทางเข้า Mini App</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      การ์ดเมนูรวมทางลัด สั่งซื้อ, สต็อก, สแกน POS สำหรับส่งในแชท LINE
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs gap-1.5 font-semibold text-[#06C755]"
                    onClick={handlePreviewPortalFlex}
                  >
                    <Eye className="size-3.5" /> ดูตัวอย่าง Flex Message
                  </Button>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: ZONES */}
          <TabsContent value="zones" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">โซนสินค้า</h2>
                <p className="text-xs text-muted-foreground">ตำแหน่งจัดเก็บสินค้าในร้าน</p>
              </div>
              <Button
                className="h-11 sm:h-10 font-semibold gap-1.5 rounded-xl active:scale-95 shadow-sm"
                onClick={() => {
                  setEditingZone(null);
                  setZoneForm({ name: "", code: "", description: "" });
                  setZoneModalOpen(true);
                }}
              >
                <Plus className="size-4" /> เพิ่มโซนใหม่
              </Button>
            </div>

            {/* Mobile Zone Cards */}
            <div className="block md:hidden space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between rounded-2xl border bg-card p-3.5 shadow-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {zone.code || "—"}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground truncate">
                        {zone.name}
                      </span>
                    </div>
                    {zone.description ? (
                      <p className="text-xs text-muted-foreground truncate">{zone.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleEditZone(zone)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleDeleteZone(zone.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block rounded-2xl">
              <CardContent className="pt-4">
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">รหัสย่อ</TableHead>
                        <TableHead>ชื่อโซนสินค้า</TableHead>
                        <TableHead>รายละเอียด / ตำแหน่ง</TableHead>
                        <TableHead className="w-28 text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {zones.map((zone) => (
                        <TableRow key={zone.id}>
                          <TableCell className="font-mono">
                            <Badge variant="secondary">{zone.code || "—"}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{zone.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {zone.description || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditZone(zone)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => handleDeleteZone(zone.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: CATEGORIES */}
          <TabsContent value="categories" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">หมวดหมู่สินค้า</h2>
                <p className="text-xs text-muted-foreground">
                  จัดกลุ่มประเภทสินค้าเพื่อการค้นหาที่รวดเร็ว พร้อมสร้างรหัสย่ออัตโนมัติ
                </p>
              </div>
              <Button
                className="h-11 sm:h-10 font-semibold gap-1.5 rounded-xl active:scale-95 shadow-sm"
                onClick={handleOpenAddCategory}
              >
                <Plus className="size-4" /> เพิ่มหมวดหมู่ใหม่
              </Button>
            </div>

            {/* Missing Code Quick Auto-Fill Banner */}
            {missingCategoryCodeCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs sm:text-sm font-semibold">
                      พบ {missingCategoryCodeCount} หมวดหมู่ที่ยังไม่มีรหัสย่อ (Code)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ระบบสามารถสร้างรหัสย่อมาตรฐานให้อัตโนมัติ เช่น นม → MLK, เหล้า → ALC, เบียร์ →
                      BEER, บุหรี่ → TOB, โค้ก → COKE
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs gap-1.5 shrink-0 self-start sm:self-auto shadow-xs active:scale-95"
                  onClick={handleAutoFillAllMissingCodes}
                >
                  <Sparkles className="size-3.5" /> สร้างรหัสอัตโนมัติทั้งหมด (
                  {missingCategoryCodeCount})
                </Button>
              </div>
            )}

            {/* Mobile Category Cards */}
            <div className="block md:hidden space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-2xl border bg-card p-3.5 shadow-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {cat.code || "—"}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground truncate">
                        {cat.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleEditCategory(cat)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block rounded-2xl">
              <CardContent className="pt-4">
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">รหัสย่อ</TableHead>
                        <TableHead>ชื่อหมวดหมู่สินค้า</TableHead>
                        <TableHead className="w-28 text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell className="font-mono">
                            <Badge variant="secondary">{cat.code || "—"}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{cat.name}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditCategory(cat)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => handleDeleteCategory(cat.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: SUBCATEGORIES */}
          <TabsContent value="subcategories" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">หมวดหมู่ย่อย</h2>
                <p className="text-xs text-muted-foreground">
                  กำหนดหมวดหมู่ย่อยและผูกกับหมวดหมู่หลักสำหรับเลือกในข้อมูลสินค้า
                </p>
              </div>
              <Button
                className="h-11 sm:h-10 font-semibold gap-1.5 rounded-xl active:scale-95 shadow-sm"
                onClick={handleOpenAddSubCategory}
                disabled={categories.length === 0}
              >
                <Plus className="size-4" /> เพิ่มหมวดหมู่ย่อย
              </Button>
            </div>

            {subCategories.length === 0 ? (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <FolderTree className="size-8 text-muted-foreground" />
                  <p className="text-sm font-semibold">ยังไม่มีหมวดหมู่ย่อย</p>
                  <p className="text-xs text-muted-foreground">
                    เพิ่มรายการที่ร้านใช้งานจริงได้จากปุ่มด้านบน
                    ไม่มีข้อมูลตัวอย่างถูกเพิ่มให้อัตโนมัติ
                  </p>
                  {categories.length === 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      กรุณาเพิ่มหมวดหมู่หลักก่อน
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <div className="block md:hidden space-y-2">
              {subCategories.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border bg-card p-3.5 shadow-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {item.code || "—"}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {categories.find((category) => category.id === item.categoryId)?.name ||
                        "ไม่พบหมวดหมู่หลัก"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleEditSubCategory(item)}
                      aria-label={`แก้ไขหมวดหมู่ย่อย ${item.name}`}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleDeleteSubCategory(item.id)}
                      aria-label={`ลบหมวดหมู่ย่อย ${item.name}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Card className="hidden md:block rounded-2xl">
              <CardContent className="pt-4">
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">รหัสย่อ</TableHead>
                        <TableHead>ชื่อหมวดหมู่ย่อย</TableHead>
                        <TableHead>หมวดหมู่หลัก</TableHead>
                        <TableHead className="w-28 text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subCategories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            ยังไม่มีหมวดหมู่ย่อย
                          </TableCell>
                        </TableRow>
                      ) : (
                        subCategories.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">
                              <Badge variant="secondary">{item.code || "—"}</Badge>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {categories.find((category) => category.id === item.categoryId)
                                ?.name || "ไม่พบหมวดหมู่หลัก"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => handleEditSubCategory(item)}
                                  aria-label={`แก้ไขหมวดหมู่ย่อย ${item.name}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive"
                                  onClick={() => handleDeleteSubCategory(item.id)}
                                  aria-label={`ลบหมวดหมู่ย่อย ${item.name}`}
                                >
                                  <Trash2 className="size-4" />
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

          {/* TAB 5: UNITS */}
          <TabsContent value="units" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">หน่วยนับสินค้า</h2>
                <p className="text-xs text-muted-foreground">หน่วยสำหรับบรรจุภัณฑ์และการนับสต็อก</p>
              </div>
              <Button
                className="h-11 sm:h-10 font-semibold gap-1.5 rounded-xl active:scale-95 shadow-sm"
                onClick={() => {
                  setEditingUnit(null);
                  setUnitForm({ name: "", shortName: "" });
                  setUnitModalOpen(true);
                }}
              >
                <Plus className="size-4" /> เพิ่มหน่วยนับใหม่
              </Button>
            </div>

            {/* Mobile Unit Cards */}
            <div className="block md:hidden space-y-2">
              {units.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between rounded-2xl border bg-card p-3.5 shadow-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-sm text-foreground">{unit.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ตัวย่อ: {unit.shortName || unit.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleEditUnit(unit)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg active:scale-90"
                      onClick={() => handleDeleteUnit(unit.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block rounded-2xl">
              <CardContent className="pt-4">
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อหน่วยนับ</TableHead>
                        <TableHead className="w-36">ตัวย่อ</TableHead>
                        <TableHead className="w-28 text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium text-foreground">{unit.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono">
                            {unit.shortName || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditUnit(unit)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => handleDeleteUnit(unit.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: LINE API */}
          <TabsContent value="line" className="space-y-4">
            {/* Status Card */}
            <Card className="rounded-2xl border-emerald-500/30 shadow-xs">
              <CardHeader className="bg-[#06C755] text-white rounded-t-2xl p-4">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <MessageSquare className="size-5" /> สถานะการเชื่อมต่อ LINE Ecosystem
                </CardTitle>
                <CardDescription className="text-emerald-100 text-xs">
                  LINE Mini App, LIFF SDK, และ Messaging API Gateway
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <Alert className="bg-muted/70 border-border/80 rounded-xl">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <AlertTitle className="text-xs font-semibold">
                    Zero Secret Leakage & Direct LIFF SDK
                  </AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    เชื่อมต่อ LINE Official Account และ LINE Mini App โดยตรงผ่าน Server Environment
                    Variables ปลอดภัย 100%
                  </AlertDescription>
                </Alert>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3.5 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Smartphone className="size-4 text-[#06C755]" /> LINE Mini App / LIFF
                      </span>
                      {clientLiffId || lineStatus?.hasLiffId ? (
                        <Badge className="bg-[#06C755] text-white text-[10px]">เชื่อมต่อแล้ว</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 text-[10px]">
                          รอตั้งค่า LIFF ID
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="200xxxxxxx-xxxxxxxx"
                          value={editingLiffId}
                          onChange={(e) => setEditingLiffId(e.target.value)}
                          className="h-8 font-mono text-xs rounded-lg"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveLiffId}
                          className="h-8 text-xs font-bold rounded-lg px-3 bg-[#06C755] hover:bg-[#05b34c] text-white shrink-0"
                        >
                          บันทึก
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestOpenLiffPicker}
                        className="w-full h-8 text-[11px] rounded-lg font-semibold gap-1 text-[#06C755] border-[#06C755]/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      >
                        <Users className="size-3.5" /> ทดสอบเปิดรายชื่อเพื่อน (LIFF Picker)
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border p-3.5 space-y-2 bg-card">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Bot className="size-4 text-[#06C755]" /> LINE Messaging API (Bot)
                      </span>
                      {serverLineConfig?.hasAccessToken ? (
                        <Badge className="bg-[#06C755] text-white text-[10px]">พร้อมทำงาน</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          รอตั้งค่า
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Channel Access Token:</span>
                        <span className="font-mono text-foreground">
                          {serverLineConfig?.hasAccessToken
                            ? "บันทึกใน Server แล้ว"
                            : "ยังไม่ได้ระบุ"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CORE GATEWAY: LINE Messaging API as Mini App Portal Entrance */}
            <Card className="rounded-2xl border-border/80 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="size-5 text-[#06C755]" /> LINE Messaging API ➔
                      ทางเข้าหลัก LINE Mini App
                    </CardTitle>
                    <CardDescription className="text-xs">
                      ใช้ LINE Official Account และ Messaging API ส่งการ์ดทางเข้าและตั้งค่า Rich
                      Menu ให้ผู้ใช้แตะเปิด Mini App ได้ทันที
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs rounded-xl gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"
                      onClick={handlePreviewPortalFlex}
                    >
                      <Eye className="size-3.5" /> ดูตัวอย่างการ์ด Flex ทางเข้า
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 text-xs rounded-xl font-bold gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white shadow-xs"
                      onClick={() => handleSendPortalCard(followers[0]?.userId, false)}
                      disabled={portalSending}
                    >
                      <Send className="size-3.5" />
                      {portalSending ? "กำลังส่ง..." : "ทดสอบส่งการ์ดทางเข้าเข้า LINE"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {portalStatusMsg ? (
                  <Alert
                    className={`rounded-xl ${
                      portalStatusMsg.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}
                  >
                    {portalStatusMsg.type === "success" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="size-4 text-destructive" />
                    )}
                    <AlertTitle className="text-xs font-semibold">
                      {portalStatusMsg.type === "success" ? "ส่งสำเร็จ" : "ข้อผิดพลาด"}
                    </AlertTitle>
                    <AlertDescription className="text-xs">{portalStatusMsg.text}</AlertDescription>
                  </Alert>
                ) : null}

                {/* LIFF Endpoint URL Configuration Guide */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <ExternalLink className="size-4 text-primary" /> Endpoint URL ใน LINE
                      Developers Console (สำหรับเริ่มที่แดชบอร์ด)
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 font-semibold text-primary border-primary/40 bg-background"
                      onClick={() =>
                        handleCopyLink(
                          typeof window !== "undefined" ? window.location.origin + "/" : "/",
                          "endpoint_url",
                        )
                      }
                    >
                      {copiedKey === "endpoint_url" ? (
                        <>
                          <Check className="size-3 text-emerald-600" /> คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> คัดลอก Endpoint URL
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="font-mono text-xs text-primary bg-background p-2.5 rounded-lg border font-semibold">
                    {typeof window !== "undefined" ? window.location.origin + "/" : "/"}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    💡 <strong>สำคัญมาก:</strong> ใน LINE Developers Console &gt; LIFF App &gt; ช่อง{" "}
                    <strong>Endpoint URL</strong> ให้กรอก URL หน้าแรก (จบด้วย <code>/</code>{" "}
                    โดยไม่ต้องใส่ <code>/reorder</code>) เพื่อให้เมื่อผู้ใช้เปิดแอพผ่าน LINE
                    หรือคลิก LIFF URL ระบบจะเริ่มที่ <strong>หน้าแรก / แดชบอร์ด (Dashboard)</strong>{" "}
                    เป็นค่าเริ่มต้นเสมอ
                  </p>
                </div>

                {/* 1-Click Copy Links for Rich Menu & LINE OA */}
                <div>
                  <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Smartphone className="size-4 text-[#06C755]" /> ลิงก์ทางเข้า Mini App แต่ละหน้า
                    (สำหรับใส่ใน Rich Menu บน LINE Official Account Manager)
                  </h3>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {/* Link 1: Dashboard (Default) */}
                    <div className="rounded-xl border-2 border-emerald-500/40 p-3 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          📊 1. ทางเข้าหน้าแดชบอร์ดหลัก (Dashboard - หน้าแรก)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1 text-emerald-700 dark:text-emerald-300"
                          onClick={() =>
                            handleCopyLink(
                              `https://liff.line.me/${clientLiffId || "2007000000-xxxxxx"}`,
                              "dashboard_link",
                            )
                          }
                        >
                          {copiedKey === "dashboard_link" ? (
                            <>
                              <Check className="size-3 text-emerald-600" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> คัดลอกลิงก์
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="font-mono text-[11px] text-foreground font-semibold truncate bg-background p-2 rounded-lg border">
                        https://liff.line.me/{clientLiffId || "2007000000-xxxxxx"}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        *ใช้สำหรับตั้งค่าปุ่มหลัก เพื่อให้เปิดเข้าสู่หน้าแดชบอร์ดทันที
                      </span>
                    </div>

                    {/* Link 2: Reorder */}
                    <div className="rounded-xl border p-3 bg-muted/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1">
                          🛒 2. ทางเข้าหน้าสั่งซื้อสินค้า (Reorder)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1 text-emerald-700 dark:text-emerald-300"
                          onClick={() =>
                            handleCopyLink(
                              `https://liff.line.me/${clientLiffId || "2007000000-xxxxxx"}/reorder`,
                              "reorder_link",
                            )
                          }
                        >
                          {copiedKey === "reorder_link" ? (
                            <>
                              <Check className="size-3 text-emerald-600" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> คัดลอกลิงก์
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate bg-background p-2 rounded-lg border">
                        https://liff.line.me/{clientLiffId || "2007000000-xxxxxx"}/reorder
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        *ใช้สำหรับปุ่มลัดสั่งซื้อสินค้าประจำวัน / ออกใบ PO
                      </span>
                    </div>

                    {/* Link 3: Stock */}
                    <div className="rounded-xl border p-3 bg-muted/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1">
                          📦 3. ทางเข้าหน้าจัดการสต็อก (Stock)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1 text-emerald-700 dark:text-emerald-300"
                          onClick={() =>
                            handleCopyLink(
                              `https://liff.line.me/${clientLiffId || "2007000000-xxxxxx"}/stock`,
                              "stock_link",
                            )
                          }
                        >
                          {copiedKey === "stock_link" ? (
                            <>
                              <Check className="size-3 text-emerald-600" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> คัดลอกลิงก์
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate bg-background p-2 rounded-lg border">
                        https://liff.line.me/{clientLiffId || "2007000000-xxxxxx"}/stock
                      </div>
                    </div>

                    {/* Link 4: Scan */}
                    <div className="rounded-xl border p-3 bg-muted/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1">
                          📷 4. ทางเข้าหน้าสแกนบาร์โค้ด (POS Scanner)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1 text-emerald-700 dark:text-emerald-300"
                          onClick={() =>
                            handleCopyLink(
                              `https://liff.line.me/${clientLiffId || "2007000000-xxxxxx"}/scan`,
                              "scan_link",
                            )
                          }
                        >
                          {copiedKey === "scan_link" ? (
                            <>
                              <Check className="size-3 text-emerald-600" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> คัดลอกลิงก์
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate bg-background p-2 rounded-lg border">
                        https://liff.line.me/{clientLiffId || "2007000000-xxxxxx"}/scan
                      </div>
                    </div>
                  </div>
                </div>

                {/* Steps to setup Rich Menu on manager.line.biz */}
                <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-2 text-xs">
                  <div className="font-bold text-foreground flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                    <Info className="size-4 text-[#06C755]" /> วิธีตั้งค่า Rich Menu ใน LINE
                    Official Account Manager (ทำครั้งเดียว):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1 leading-relaxed">
                    <li>
                      เปิดเว็บ{" "}
                      <a
                        href="https://manager.line.biz"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary font-bold underline"
                      >
                        manager.line.biz
                      </a>{" "}
                      แล้วเข้าสู่ระบบบัญชี LINE Official Account ของร้าน
                    </li>
                    <li>
                      ไปที่เมนูด้านซ้ายเลือก <strong>"ริชเมนู (Rich Menus)"</strong> ➔ กดปุ่ม{" "}
                      <strong>"สร้างใหม่ (Create)"</strong>
                    </li>
                    <li>เลือกรูปแบบเทมเพลตปุ่ม (เช่น 4 ช่อง หรือ 6 ช่อง) และอัปโหลดภาพไอคอนเมนู</li>
                    <li>
                      ในช่องการกระทำ (Action) ให้เลือกประเภทเป็น <strong>"ลิงก์ (Link)"</strong>{" "}
                      แล้วนำลิงก์ <code>https://liff.line.me/...</code>{" "}
                      จากตารางด้านบนไปใส่ในแต่ละช่อง
                    </li>
                    <li>
                      กด <strong>"บันทึกและเปิดใช้งาน (Save & Publish)"</strong> ➔
                      เมื่อผู้ใช้เปิดแชท LINE OA จะเห็นเมนูด้านล่าง แตะแล้วเปิด Mini App
                      เต็มจอทันที!
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* FOLLOWER / USER MODAL */}
        <Dialog open={followerModalOpen} onOpenChange={setFollowerModalOpen}>
          <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingFollower
                  ? "แก้ไขข้อมูลผู้ใช้งาน / User ID"
                  : "เพิ่มผู้ใช้งาน / LINE User ID"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                กรอก LINE User ID หรือ Group ID จริงจากข้อมูลของ LINE เพื่อใช้ส่งการแจ้งเตือน
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ชื่อผู้ใช้งาน (Display Name) *</Label>
                <Input
                  placeholder="เช่น ผู้จัดการร้าน, แคชเชียร์ A"
                  className="h-10 rounded-xl"
                  value={followerForm.displayName}
                  onChange={(e) =>
                    setFollowerForm({ ...followerForm, displayName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">LINE User ID *</Label>
                <Input
                  placeholder="วาง LINE User ID / Group ID ที่ตรวจสอบแล้ว"
                  className="h-10 font-mono text-xs rounded-xl"
                  value={followerForm.userId}
                  onChange={(e) => setFollowerForm({ ...followerForm, userId: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">URL รูปโปรไฟล์ (ไม่บังคับ)</Label>
                <Input
                  placeholder="https://..."
                  className="h-10 text-xs rounded-xl"
                  value={followerForm.pictureUrl}
                  onChange={(e) => setFollowerForm({ ...followerForm, pictureUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">สิทธิ์การใช้งาน (Role)</Label>
                <Select
                  value={followerForm.role}
                  onValueChange={(val) =>
                    setFollowerForm({ ...followerForm, role: val as "admin" | "staff" | "viewer" })
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (ผู้ดูแลระบบ)</SelectItem>
                    <SelectItem value="staff">Staff (พนักงานประจำ)</SelectItem>
                    <SelectItem value="viewer">Viewer (ดูข้อมูลได้อย่างเดียว)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="h-11 rounded-xl w-full sm:w-auto"
                onClick={() => setFollowerModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-11 rounded-xl w-full sm:w-auto font-semibold"
                onClick={handleSaveFollower}
                disabled={!followerForm.displayName.trim() || !followerForm.userId.trim()}
              >
                บันทึกผู้ใช้งาน
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* FLEX PREVIEW MODAL */}
        <Dialog open={previewFlexModalOpen} onOpenChange={setPreviewFlexModalOpen}>
          <DialogContent className="w-[96vw] max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileCode2 className="size-5 text-emerald-600" /> {previewFlexTitle}
              </DialogTitle>
              <DialogDescription className="text-xs">
                การจำลองแสดงผล LINE Flex Message และโครงสร้าง JSON สำหรับ LINE Messaging API
              </DialogDescription>
            </DialogHeader>

            <div className="py-1">
              <FlexMessageVisualizer
                flexData={previewFlexJson}
                title={previewFlexTitle}
                className="w-full"
              />
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button
                className="w-full sm:w-auto rounded-xl"
                onClick={() => setPreviewFlexModalOpen(false)}
              >
                ปิดหน้าต่าง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ZONE MODAL */}
        <Dialog open={zoneModalOpen} onOpenChange={setZoneModalOpen}>
          <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingZone ? "แก้ไขข้อมูลโซนสินค้า" : "เพิ่มโซนสินค้าใหม่"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ชื่อโซนสินค้า *</Label>
                <Input
                  placeholder="เช่น หน้าร้าน แถว A, ตู้แช่เย็น 1"
                  className="h-10 rounded-xl"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">รหัสย่อโซน (Code)</Label>
                <Input
                  placeholder="เช่น Z-FRONT, COOL-01"
                  className="h-10 font-mono rounded-xl"
                  value={zoneForm.code}
                  onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">รายละเอียดตำแหน่ง</Label>
                <Input
                  placeholder="เช่น ชั้นวางแถวกลางติดประตูทางเข้า"
                  className="h-10 rounded-xl"
                  value={zoneForm.description}
                  onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="h-11 rounded-xl w-full sm:w-auto"
                onClick={() => setZoneModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-11 rounded-xl w-full sm:w-auto font-semibold"
                onClick={handleSaveZone}
                disabled={!zoneForm.name.trim()}
              >
                บันทึกโซน
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CATEGORY MODAL */}
        <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
          <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingCat ? "แก้ไขหมวดหมู่สินค้า" : "เพิ่มหมวดหมู่สินค้าใหม่"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                กำหนดชื่อและรหัสหมวดหมู่สินค้า ระบบจะกรอกรหัสให้อัตโนมัติขณะพิมพ์ชื่อ
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">ชื่อหมวดหมู่ *</Label>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="size-3" /> กรอกรหัสให้อัตโนมัติ
                  </span>
                </div>
                <Input
                  placeholder="เช่น นม, เครื่องดื่ม, ขนมขบเคี้ยว, เบียร์"
                  className="h-10 rounded-xl"
                  value={catForm.name}
                  onChange={(e) => handleCategoryNameChange(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">รหัสหมวดหมู่ (Code)</Label>
                  <button
                    type="button"
                    onClick={handleRegenerateCategoryCode}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium transition-colors"
                    title="สร้างรหัสอัตโนมัติใหม่"
                  >
                    <RefreshCw className="size-3" /> สร้างรหัสใหม่
                  </button>
                </div>
                <div className="relative">
                  <Input
                    placeholder="เช่น MLK, BEV, BEER"
                    className="h-10 font-mono rounded-xl uppercase pr-20"
                    value={catForm.code}
                    onChange={(e) => handleCategoryCodeChange(e.target.value)}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Badge variant="outline" className="text-[10px] font-mono py-0 h-5">
                      {catForm.code ? `${catForm.code.length} ตัวอักษร` : "ว่าง"}
                    </Badge>
                  </div>
                </div>

                {/* Candidate Suggestions */}
                {catForm.name.trim() && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] text-muted-foreground">รหัสแนะนำที่เลือกได้:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {getCategoryCodeSuggestions(catForm.name, categories, editingCat?.id).map(
                        (sug) => {
                          const isSelected = catForm.code === sug;
                          return (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setCatForm((prev) => ({ ...prev, code: sug }));
                                setIsCodeManuallyEdited(true);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-muted/70 hover:bg-muted text-foreground border-border hover:border-foreground/30"
                              }`}
                            >
                              {sug}
                              {isSelected && " ✓"}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="h-11 rounded-xl w-full sm:w-auto"
                onClick={() => setCatModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-11 rounded-xl w-full sm:w-auto font-semibold"
                onClick={handleSaveCategory}
                disabled={!catForm.name.trim()}
              >
                {editingCat ? "บันทึกการแก้ไข" : "บันทึกหมวดหมู่"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SUBCATEGORY MODAL */}
        <Dialog open={subCategoryModalOpen} onOpenChange={setSubCategoryModalOpen}>
          <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingSubCategory ? "แก้ไขหมวดหมู่ย่อย" : "เพิ่มหมวดหมู่ย่อยใหม่"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                เลือกหมวดหมู่หลักและกำหนดชื่อหมวดหมู่ย่อยสำหรับข้อมูลสินค้าจริง
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">หมวดหมู่หลัก *</Label>
                <CategorySelect
                  value={subCategoryForm.categoryId}
                  onChange={(categoryId) =>
                    setSubCategoryForm((previous) => ({ ...previous, categoryId }))
                  }
                  placeholder="เลือกหมวดหมู่หลัก"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ชื่อหมวดหมู่ย่อย *</Label>
                <Input
                  placeholder="เช่น น้ำดื่ม, บะหมี่, ผงซักฟอก"
                  className="h-10 rounded-xl"
                  value={subCategoryForm.name}
                  onChange={(event) => handleSubCategoryNameChange(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">รหัสหมวดหมู่ย่อย</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const code = generateCategoryCode(
                        subCategoryForm.name,
                        subCategories,
                        editingSubCategory?.id,
                      );
                      setIsSubCategoryCodeManuallyEdited(false);
                      setSubCategoryForm((previous) => ({ ...previous, code }));
                    }}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="size-3" /> สร้างรหัสอัตโนมัติ
                  </button>
                </div>
                <Input
                  placeholder="ระบบสร้างให้อัตโนมัติ หรือกรอกเอง"
                  className="h-10 rounded-xl font-mono uppercase"
                  value={subCategoryForm.code}
                  onChange={(event) => {
                    setIsSubCategoryCodeManuallyEdited(true);
                    setSubCategoryForm((previous) => ({
                      ...previous,
                      code: event.target.value.toUpperCase(),
                    }));
                  }}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="h-11 rounded-xl w-full sm:w-auto"
                onClick={() => setSubCategoryModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-11 rounded-xl w-full sm:w-auto font-semibold"
                onClick={handleSaveSubCategory}
                disabled={!subCategoryForm.categoryId || !subCategoryForm.name.trim()}
              >
                {editingSubCategory ? "บันทึกการแก้ไข" : "บันทึกหมวดหมู่ย่อย"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* UNIT MODAL */}
        <Dialog open={unitModalOpen} onOpenChange={setUnitModalOpen}>
          <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingUnit ? "แก้ไขหน่วยนับ" : "เพิ่มหน่วยนับใหม่"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ชื่อหน่วยนับ *</Label>
                <Input
                  placeholder="เช่น ชิ้น, กล่อง, แพ็ค, ขวด"
                  className="h-10 rounded-xl"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ชื่อย่อ (ถ้ามี)</Label>
                <Input
                  placeholder="เช่น ชิ้น, กก., มล."
                  className="h-10 rounded-xl"
                  value={unitForm.shortName}
                  onChange={(e) => setUnitForm({ ...unitForm, shortName: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="h-11 rounded-xl w-full sm:w-auto"
                onClick={() => setUnitModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="h-11 rounded-xl w-full sm:w-auto font-semibold"
                onClick={handleSaveUnit}
                disabled={!unitForm.name.trim()}
              >
                บันทึกหน่วยนับ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
