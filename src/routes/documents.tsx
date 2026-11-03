import { createFileRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import {
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DocumentType,
  type DocumentStatus,
  type SalesDocument,
  salesDocService,
} from "@/lib/sales-document-service";
import { DocumentA4Print } from "@/components/documents/DocumentA4Print";
import { DocumentModal } from "@/components/documents/DocumentModal";
import { ExpenseManagementTab } from "@/components/documents/ExpenseManagementTab";
import { ReceiptOcrModal } from "@/components/documents/ReceiptOcrModal";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/documents": {
      id: "/documents";
      path: "/documents";
      fullPath: "/documents";
      preLoaderRoute: typeof rootRoute;
      parentRoute: typeof rootRoute;
    };
  }
}

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const [docSection, setDocSection] = useState<"SALES" | "EXPENSES">("SALES");
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // State trigger for re-rendering documents list
  const [refreshKey, setRefreshKey] = useState(0);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tab") === "expenses" || p.get("type") === "expense") {
        setDocSection("EXPENSES");
      }
    }
  }, []);

  React.useEffect(() => {
    const onStoreChange = () => setRefreshKey((k) => k + 1);
    window.addEventListener("minimark_store_change", onStoreChange);
    window.addEventListener("storage", onStoreChange);
    return () => {
      window.removeEventListener("minimark_store_change", onStoreChange);
      window.removeEventListener("storage", onStoreChange);
    };
  }, []);

  // Modal / Preview state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDocType, setModalDocType] = useState<DocumentType>("QUOTATION");
  const [editingDoc, setEditingDoc] = useState<SalesDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SalesDocument | null>(null);

  // Fetch all documents
  const allDocuments = useMemo(() => {
    // depend on refreshKey
    void refreshKey;
    return salesDocService.getDocuments();
  }, [refreshKey]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      // Tab filter
      if (activeTab !== "ALL" && doc.type !== activeTab) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && doc.status !== statusFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDocNum = doc.docNumber.toLowerCase().includes(q);
        const matchCustomer = doc.customer.name.toLowerCase().includes(q);
        const matchTaxId = doc.customer.taxId?.toLowerCase().includes(q);
        const matchItem = doc.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchDocNum && !matchCustomer && !matchTaxId && !matchItem) {
          return false;
        }
      }
      return true;
    });
  }, [allDocuments, activeTab, statusFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalSales = 0;
    let pendingReceivable = 0;
    let totalVatCollected = 0;
    let quotationPending = 0;

    allDocuments.forEach((doc) => {
      if (doc.type === "TAX_INVOICE_RECEIPT" && doc.status === "PAID") {
        totalSales += doc.calculation.grandTotal;
        totalVatCollected += doc.calculation.vatAmount;
      } else if (doc.type === "BILLING_INVOICE" && doc.status === "PENDING") {
        pendingReceivable += doc.calculation.grandTotal;
      } else if (doc.type === "QUOTATION" && doc.status === "PENDING") {
        quotationPending += 1;
      }
    });

    return {
      totalSales,
      pendingReceivable,
      totalVatCollected,
      quotationPending,
    };
  }, [allDocuments]);

  // Actions
  const handleOpenCreate = (type: DocumentType) => {
    setEditingDoc(null);
    setModalDocType(type);
    setModalOpen(true);
  };

  const handleEdit = (doc: SalesDocument) => {
    setEditingDoc(doc);
    setModalDocType(doc.type);
    setModalOpen(true);
  };

  const handleDelete = (id: string, docNumber: string) => {
    if (confirm(`คุณต้องการลบเอกสาร ${docNumber} หรือไม่?`)) {
      salesDocService.deleteDocument(id);
      setRefreshKey((k) => k + 1);
      toast.success(`ลบเอกสาร ${docNumber} เรียบร้อยแล้ว`);
    }
  };

  const handleConvert = (doc: SalesDocument, targetType: DocumentType) => {
    const targetTitle =
      targetType === "BILLING_INVOICE" ? "ใบแจ้งหนี้/ใบวางบิล" : "ใบเสร็จรับเงิน/ใบกำกับภาษี";

    if (
      confirm(
        `แปลงเอกสาร ${doc.docNumber} ไปเป็น "${targetTitle}" ใช่หรือไม่? ${
          targetType === "TAX_INVOICE_RECEIPT" ? "(ระบบจะบันทึกตัดสต็อกอัตโนมัติ)" : ""
        }`,
      )
    ) {
      const converted = salesDocService.convertDocument(doc.id, targetType);
      if (converted) {
        setRefreshKey((k) => k + 1);
        toast.success(`แปลงเอกสารสำเร็จ เลขที่ ${converted.docNumber}`);
        setPreviewDoc(converted);
      }
    }
  };

  const handleMarkPaid = (doc: SalesDocument) => {
    if (confirm(`บันทึกรับชำระเงินสำหรับเอกสาร ${doc.docNumber} หรือไม่?`)) {
      salesDocService.updateDocument(doc.id, {
        status: "PAID",
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      setRefreshKey((k) => k + 1);
      toast.success(`บันทึกรับชำระเงิน ${doc.docNumber} เรียบร้อยแล้ว`);
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 font-semibold text-[11px]">
            <CheckCircle2 className="size-3" /> ชำระแล้ว
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 hover:bg-sky-500/20 border-sky-500/30 gap-1 font-semibold text-[11px]">
            <FileCheck2 className="size-3" /> อนุมัติแล้ว
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 gap-1 font-semibold text-[11px]">
            <Clock className="size-3" /> รอดำเนินการ
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
            ร่าง
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <XCircle className="size-3" /> ยกเลิก
          </Badge>
        );
    }
  };

  const getTypeBadge = (type: DocumentType) => {
    switch (type) {
      case "QUOTATION":
        return (
          <Badge
            variant="outline"
            className="border-sky-300 text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 text-[10px] font-mono"
          >
            QT ใบเสนอราคา
          </Badge>
        );
      case "BILLING_INVOICE":
        return (
          <Badge
            variant="outline"
            className="border-indigo-300 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-mono"
          >
            INV ใบแจ้งหนี้
          </Badge>
        );
      case "TAX_INVOICE_RECEIPT":
        return (
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono"
          >
            TAX ใบกำกับภาษี
          </Badge>
        );
      case "CREDIT_NOTE":
        return (
          <Badge
            variant="outline"
            className="border-rose-300 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 text-[10px] font-mono"
          >
            CN ใบลดหนี้
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Main Section Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex p-1 bg-muted/70 rounded-2xl border gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setDocSection("SALES")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial",
              docSection === "SALES"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Receipt className="size-4 text-primary" /> เอกสารขาย & ภาษี (Sales Docs)
          </button>
          <button
            type="button"
            onClick={() => setDocSection("EXPENSES")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial",
              docSection === "EXPENSES"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="size-4 text-emerald-600" /> บิลซื้อ & รายจ่าย (OCR)
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            onClick={() => setOcrModalOpen(true)}
          >
            <Sparkles className="size-3.5" /> + สแกนบิล OCR (AI Vision)
          </Button>
        </div>
      </div>

      {docSection === "EXPENSES" ? (
        <ExpenseManagementTab />
      ) : (
        <>
          {/* Page Header */}
          <PageHeader
            title="เอกสารขาย & ใบกำกับภาษี (Sales & Tax Invoices)"
            description="ระบบบริหารเอกสารขายสไตล์ FlowAccount: ใบเสนอราคา, ใบแจ้งหนี้/วางบิล, ใบกำกับภาษี VAT 7%, และรายงาน ภ.พ.30"
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl text-xs font-semibold"
                  onClick={() => handleOpenCreate("QUOTATION")}
                >
                  <Plus className="size-3.5 text-sky-600" /> + ใบเสนอราคา (QT)
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl text-xs font-semibold"
                  onClick={() => handleOpenCreate("BILLING_INVOICE")}
                >
                  <Plus className="size-3.5 text-indigo-600" /> + ใบแจ้งหนี้ (INV)
                </Button>

                <Button
                  size="sm"
                  className="gap-1.5 rounded-xl text-xs font-semibold shadow-sm"
                  onClick={() => handleOpenCreate("TAX_INVOICE_RECEIPT")}
                >
                  <Receipt className="size-3.5" /> + ออกใบกำกับภาษี (TAX)
                </Button>
              </div>
            }
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sales */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">
                  ยอดขายรับชำระแล้ว (Tax Invoices)
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  ฿{metrics.totalSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3.5 text-emerald-500" /> จากใบเสร็จรับเงิน/ใบกำกับภาษี
                </p>
              </CardContent>
            </Card>

            {/* Pending Receivables */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">
                  ลูกหนี้ค้างรับ (Pending Invoices)
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  ฿{metrics.pendingReceivable.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3.5 text-amber-500" /> จากใบแจ้งหนี้ที่รอครบกำหนดชำระ
                </p>
              </CardContent>
            </Card>

            {/* VAT Collected */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">
                  ภาษีขายสะสม (Output VAT 7%)
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  ฿{metrics.totalVatCollected.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="size-3.5 text-indigo-500" /> สำหรับยื่นแบบ ภ.พ.30 กรมสรรพากร
                </p>
              </CardContent>
            </Card>

            {/* Quotations pending */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">
                  ใบเสนอราคารออนุมัติ
                </CardDescription>
                <CardTitle className="text-xl sm:text-2xl font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                  {metrics.quotationPending}{" "}
                  <span className="text-sm font-normal text-muted-foreground">ฉบับ</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <FileCheck2 className="size-3.5 text-sky-500" /> รอแปลงเป็นใบแจ้งหนี้/ใบเสร็จ
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs & Table */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-3">
                <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex-wrap">
                  <TabsTrigger value="ALL" className="rounded-lg text-xs py-1.5 px-3">
                    เอกสารทั้งหมด ({allDocuments.length})
                  </TabsTrigger>
                  <TabsTrigger value="QUOTATION" className="rounded-lg text-xs py-1.5 px-3">
                    ใบเสนอราคา (QT)
                  </TabsTrigger>
                  <TabsTrigger value="BILLING_INVOICE" className="rounded-lg text-xs py-1.5 px-3">
                    ใบแจ้งหนี้ / ใบวางบิล (INV)
                  </TabsTrigger>
                  <TabsTrigger
                    value="TAX_INVOICE_RECEIPT"
                    className="rounded-lg text-xs py-1.5 px-3"
                  >
                    ใบเสร็จ / ใบกำกับภาษี (TAX)
                  </TabsTrigger>
                </TabsList>

                {/* Search & Filters */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาเลขที่, ลูกค้า, สินค้า..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs rounded-xl"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs rounded-xl">
                      <SelectValue placeholder="สถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                      <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
                      <SelectItem value="PAID">ชำระแล้ว</SelectItem>
                      <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
                      <SelectItem value="DRAFT">ร่าง</SelectItem>
                      <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table Content */}
              <div className="mt-4 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground border-b border-border font-semibold">
                      <tr>
                        <th className="py-3 px-4">เลขที่เอกสาร</th>
                        <th className="py-3 px-4">ประเภท</th>
                        <th className="py-3 px-4">ลูกค้า / ผู้ซื้อ</th>
                        <th className="py-3 px-4">วันที่ออก / ครบกำหนด</th>
                        <th className="py-3 px-4 text-right">ยอดรวมทั้งสิ้น</th>
                        <th className="py-3 px-4 text-center">สถานะ</th>
                        <th className="py-3 px-4 text-right">การกระทำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Receipt className="size-8 text-muted-foreground/50" />
                              <p className="font-medium text-sm">ไม่พบเอกสารในหมวดหมู่นี้</p>
                              <p className="text-xs text-muted-foreground">
                                คลิกปุ่มด้านบนเพื่อสร้างใบเสนอราคา ใบแจ้งหนี้ หรือใบกำกับภาษีใหม่
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => (
                          <tr key={doc.id} className="hover:bg-muted/30 transition-colors group">
                            {/* Doc Number & Ref */}
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-foreground text-xs flex items-center gap-1.5">
                                {doc.docNumber}
                              </div>
                              {doc.referenceDocNumber && (
                                <span className="text-[10px] text-muted-foreground">
                                  อ้างอิง: {doc.referenceDocNumber}
                                </span>
                              )}
                            </td>

                            {/* Type Badge */}
                            <td className="py-3 px-4">{getTypeBadge(doc.type)}</td>

                            {/* Customer */}
                            <td className="py-3 px-4 max-w-[220px]">
                              <div className="font-semibold text-foreground truncate">
                                {doc.customer.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {doc.customer.taxId
                                  ? `Tax ID: ${doc.customer.taxId}`
                                  : "บุคคลธรรมดา"}
                              </div>
                            </td>

                            {/* Dates */}
                            <td className="py-3 px-4">
                              <div className="text-foreground">{doc.issueDate}</div>
                              <div className="text-[10px] text-muted-foreground">
                                ครบกำหนด: {doc.dueDate}
                              </div>
                            </td>

                            {/* Grand Total */}
                            <td className="py-3 px-4 text-right">
                              <div className="font-mono font-bold text-foreground text-sm">
                                ฿
                                {doc.calculation.grandTotal.toLocaleString("th-TH", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                VAT: ฿
                                {doc.calculation.vatAmount.toLocaleString("th-TH", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">{getStatusBadge(doc.status)}</td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 rounded-lg gap-1 text-xs font-semibold"
                                  onClick={() => setPreviewDoc(doc)}
                                  title="ดูและพิมพ์เอกสาร A4"
                                >
                                  <Eye className="size-3.5 text-primary" /> พิมพ์ A4
                                </Button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8 rounded-lg"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel className="text-xs">
                                      จัดการเอกสาร
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() => setPreviewDoc(doc)}
                                    >
                                      <Printer className="size-3.5" /> ดูตัวอย่าง & พิมพ์
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="gap-2 text-xs"
                                      onClick={() => handleEdit(doc)}
                                    >
                                      <Pencil className="size-3.5" /> แก้ไขเอกสาร
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    {/* Document Conversion Workflow (FlowAccount standard) */}
                                    {doc.type === "QUOTATION" && (
                                      <DropdownMenuItem
                                        className="gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium"
                                        onClick={() => handleConvert(doc, "BILLING_INVOICE")}
                                      >
                                        <ArrowRightLeft className="size-3.5" /> แปลงเป็นใบแจ้งหนี้
                                        (INV)
                                      </DropdownMenuItem>
                                    )}

                                    {doc.type === "BILLING_INVOICE" && (
                                      <>
                                        <DropdownMenuItem
                                          className="gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                                          onClick={() => handleConvert(doc, "TAX_INVOICE_RECEIPT")}
                                        >
                                          <Receipt className="size-3.5" /> แปลงเป็นใบกำกับภาษี (TAX)
                                        </DropdownMenuItem>
                                        {doc.status !== "PAID" && (
                                          <DropdownMenuItem
                                            className="gap-2 text-xs text-emerald-600 font-medium"
                                            onClick={() => handleMarkPaid(doc)}
                                          >
                                            <CheckCircle2 className="size-3.5" /> บันทึกรับชำระเงิน
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    )}

                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-xs text-rose-600 dark:text-rose-400"
                                      onClick={() => handleDelete(doc.id, doc.docNumber)}
                                    >
                                      <Trash2 className="size-3.5" /> ลบเอกสาร
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Tabs>
          </div>
        </>
      )}

      {/* Modal for Creating / Editing */}
      {modalOpen && (
        <DocumentModal
          initialType={modalDocType}
          editingDoc={editingDoc}
          onClose={() => setModalOpen(false)}
          onSaved={(savedDoc) => {
            setModalOpen(false);
            setRefreshKey((k) => k + 1);
            toast.success(`บันทึกเอกสาร ${savedDoc.docNumber} สำเร็จ`);
            setPreviewDoc(savedDoc);
          }}
        />
      )}

      {/* A4 Printable Document Preview */}
      {previewDoc && <DocumentA4Print document={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {/* AI OCR Modal */}
      {ocrModalOpen && (
        <ReceiptOcrModal
          open={ocrModalOpen}
          initialType="PURCHASE_GOODS"
          onClose={() => setOcrModalOpen(false)}
          onSaved={() => {
            setDocSection("EXPENSES");
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
