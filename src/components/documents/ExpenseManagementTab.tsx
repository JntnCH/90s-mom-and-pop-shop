import React, { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  Download,
  Receipt,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  MoreHorizontal,
  Package,
  ShieldCheck,
  TrendingUp,
  RotateCw,
  Clock,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  expenseService,
  type ExpenseDocument,
  type ExpenseDocType,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/lib/expense-service";
import { ReceiptOcrModal } from "./ReceiptOcrModal";
import { ExpenseDetailModal } from "./ExpenseDetailModal";

export function ExpenseManagementTab() {
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<"ALL" | ExpenseDocType>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "THIS_MONTH">("ALL");

  // Modals
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrInitialType, setOcrInitialType] = useState<ExpenseDocType>("PURCHASE_GOODS");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseDocument | null>(null);

  // Reload data
  const loadExpenses = () => {
    setExpenses(expenseService.getExpenses());
  };

  useEffect(() => {
    loadExpenses();
    const handleUpdate = () => loadExpenses();
    window.addEventListener("minimark_expenses_change", handleUpdate);
    window.addEventListener("minimark_store_change", handleUpdate);
    return () => {
      window.removeEventListener("minimark_expenses_change", handleUpdate);
      window.removeEventListener("minimark_store_change", handleUpdate);
    };
  }, []);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = todayStr.slice(0, 7);

    return expenses.filter((e) => {
      // Type Filter
      if (docTypeFilter !== "ALL" && e.docType !== docTypeFilter) return false;

      // Category Filter
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;

      // Date Filter
      if (dateFilter === "TODAY" && e.docDate !== todayStr) return false;
      if (dateFilter === "THIS_MONTH" && !e.docDate.startsWith(thisMonthStr)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = e.docNumber.toLowerCase().includes(q);
        const matchMerchant = (e.merchantName || "").toLowerCase().includes(q);
        const matchTaxId = (e.merchantTaxId || "").toLowerCase().includes(q);
        const matchCategory = (e.category || "").toLowerCase().includes(q);
        const matchItem = e.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchNum && !matchMerchant && !matchTaxId && !matchCategory && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, docTypeFilter, categoryFilter, dateFilter, searchQuery]);

  // Financial Metrics
  const metrics = useMemo(() => {
    let totalAllExpenses = 0;
    let totalPurchases = 0;
    let totalGeneralExpenses = 0;
    let totalVat = 0;
    let totalStockItemsCredited = 0;

    expenses.forEach((e) => {
      totalAllExpenses += e.grandTotal;
      totalVat += e.vatAmount || 0;
      if (e.docType === "PURCHASE_GOODS") {
        totalPurchases += e.grandTotal;
        if (e.isStockUpdated) {
          totalStockItemsCredited += e.items.reduce(
            (sum, it) =>
              sum + (it.shouldUpdateStock !== false && it.matchedProductId ? it.quantity : 0),
            0,
          );
        }
      } else {
        totalGeneralExpenses += e.grandTotal;
      }
    });

    return {
      totalAllExpenses,
      totalPurchases,
      totalGeneralExpenses,
      totalVat,
      totalStockItemsCredited,
    };
  }, [expenses]);

  const handleOpenOcr = (type: ExpenseDocType = "PURCHASE_GOODS") => {
    setOcrInitialType(type);
    setOcrModalOpen(true);
  };

  const handleDelete = (id: string, docNumber: string) => {
    if (confirm(`คุณต้องการลบเอกสารเลขที่ ${docNumber} หรือไม่?`)) {
      expenseService.deleteExpense(id);
      loadExpenses();
      toast.success(`ลบเอกสาร ${docNumber} เรียบร้อยแล้ว`);
    }
  };

  const handleExportCsv = () => {
    try {
      expenseService.exportToCsv(filteredExpenses);
      toast.success("ส่งออกรายงานรายจ่าย (CSV) สำเร็จ");
    } catch {
      toast.error("ไม่สามารถส่งออกรายงานได้");
    }
  };

  const handleClearAll = () => {
    if (confirm("คุณต้องการล้างรายการเอกสารรายจ่ายทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
      expenseService.clearAllExpenses();
      loadExpenses();
      toast.success("ล้างรายการเอกสารรายจ่ายทั้งหมดเรียบร้อยแล้ว");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Receipt className="size-5 text-primary" /> ระบบจัดการบิลรายจ่าย & บิลซื้อสินค้า
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            บันทึกรายจ่ายด้วย AI OCR แยกชัดเจนระหว่างบิลซื้อสินค้ามาขาย (เชื่อมสต็อก)
            กับบิลค่าใช้จ่ายทั่วไป (ค่าน้ำ ค่าไฟ ไม่แตะสต็อก)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {expenses.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-xs font-semibold gap-1.5 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              onClick={handleClearAll}
            >
              <Trash2 className="size-3.5" /> ล้างทั้งหมด
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs font-semibold gap-1.5 h-9"
            onClick={handleExportCsv}
            disabled={expenses.length === 0}
          >
            <Download className="size-3.5 text-primary" /> ส่งออก CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs font-semibold gap-1.5 h-9 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
            onClick={() => handleOpenOcr("GENERAL_EXPENSE")}
          >
            <Sparkles className="size-3.5 text-amber-500" /> + สแกนบิลค่าใช้จ่าย (ค่าน้ำ/ไฟ)
          </Button>

          <Button
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            onClick={() => handleOpenOcr("PURCHASE_GOODS")}
          >
            <Sparkles className="size-3.5" /> + สแกนบิลซื้อสินค้า (AI OCR)
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Expenses */}
        <Card className="rounded-2xl border shadow-xs">
          <CardHeader className="pb-1.5 pt-3.5 px-4">
            <CardDescription className="text-xs font-medium">รายจ่ายรวมทั้งหมด</CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
              ฿{metrics.totalAllExpenses.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground">
              รวม {expenses.length} ฉบับ (ซื้อสินค้า + ค่าใช้จ่ายทั่วไป)
            </p>
          </CardContent>
        </Card>

        {/* Purchase Goods (Inventory) */}
        <Card className="rounded-2xl border shadow-xs border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-1.5 pt-3.5 px-4">
            <CardDescription className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              บิลซื้อสินค้าเข้าร้าน (ต้นทุนขาย/สต็อก)
            </CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              ฿{metrics.totalPurchases.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1 font-medium">
              <Package className="size-3.5" /> เพิ่มเข้าสต็อกแล้ว {metrics.totalStockItemsCredited}{" "}
              ชิ้น
            </p>
          </CardContent>
        </Card>

        {/* General Expenses (Utilities) */}
        <Card className="rounded-2xl border shadow-xs border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-1.5 pt-3.5 px-4">
            <CardDescription className="text-xs font-medium text-amber-800 dark:text-amber-300">
              ค่าใช้จ่ายดำเนินงานทั่วไป (ค่าน้ำ/ไฟ/เช่า)
            </CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              ฿{metrics.totalGeneralExpenses.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1 font-medium">
              <ShieldCheck className="size-3.5" /> ไม่กระทบยอดสต็อกสินค้า
            </p>
          </CardContent>
        </Card>

        {/* Total Input VAT */}
        <Card className="rounded-2xl border shadow-xs">
          <CardHeader className="pb-1.5 pt-3.5 px-4">
            <CardDescription className="text-xs font-medium">
              ภาษีซื้อสะสม (Input VAT)
            </CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
              ฿{metrics.totalVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Building2 className="size-3.5 text-indigo-500" /> นำไปหักภาษีขายในแบบ ภ.พ.30
            </p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-muted/40 border">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหาเลขที่บิล, ร้านค้า, สินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs rounded-xl bg-background"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Doc Type Filter */}
          <Select
            value={docTypeFilter}
            onValueChange={(val) => setDocTypeFilter(val as typeof docTypeFilter)}
          >
            <SelectTrigger className="h-8 w-44 text-xs rounded-xl bg-background">
              <SelectValue placeholder="ประเภทเอกสาร" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกประเภทเอกสาร</SelectItem>
              <SelectItem value="PURCHASE_GOODS">🛒 บิลซื้อสินค้าเข้าร้าน</SelectItem>
              <SelectItem value="GENERAL_EXPENSE">💡 บิลค่าใช้จ่ายทั่วไป</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40 text-xs rounded-xl bg-background">
              <SelectValue placeholder="หมวดหมู่รายจ่าย" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกหมวดหมู่ ({expenses.length})</SelectItem>
              {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.category} value={c.category}>
                  {c.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select
            value={dateFilter}
            onValueChange={(val) => setDateFilter(val as typeof dateFilter)}
          >
            <SelectTrigger className="h-8 w-32 text-xs rounded-xl bg-background">
              <SelectValue placeholder="ช่วงเวลา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทั้งหมด</SelectItem>
              <SelectItem value="TODAY">วันนี้</SelectItem>
              <SelectItem value="THIS_MONTH">เดือนนี้</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* EXPENSE DOCUMENTS TABLE */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b font-semibold">
              <tr>
                <th className="py-3 px-4">เลขที่เอกสาร / วันที่</th>
                <th className="py-3 px-4">ประเภทเอกสาร</th>
                <th className="py-3 px-4">ร้านค้า / ผู้จำหน่าย</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4">สรุปรายการสินค้า/บริการ</th>
                <th className="py-3 px-4 text-center">สถานะสต็อก</th>
                <th className="py-3 px-4 text-right">ยอดรวมสุทธิ</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-sm">ไม่พบเอกสารรายจ่ายในเงื่อนไขนี้</p>
                      <p className="text-xs text-muted-foreground">
                        คลิกปุ่ม "+ สแกนบิลซื้อสินค้า (AI OCR)" หรือ "+ สแกนบิลค่าใช้จ่าย"
                        ด้านบนเพื่อเริ่มบันทึก
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((doc) => {
                  const isPurchase = doc.docType === "PURCHASE_GOODS";
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedExpense(doc)}
                    >
                      {/* Doc Number & Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-foreground text-xs flex items-center gap-1.5">
                          {doc.docNumber}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {doc.docDate}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        {isPurchase ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                            🛒 บิลซื้อสินค้า
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 font-semibold">
                            💡 ค่าใช้จ่ายทั่วไป
                          </Badge>
                        )}
                      </td>

                      {/* Merchant */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-semibold text-foreground truncate">
                          {doc.merchantName}
                        </div>
                        {doc.merchantTaxId && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Tax ID: {doc.merchantTaxId}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {doc.category}
                        </Badge>
                      </td>

                      {/* Items Summary */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="text-foreground truncate text-xs">
                          {doc.items.map((it) => it.name).join(", ")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {doc.items.length} รายการ
                        </div>
                      </td>

                      {/* Stock Status */}
                      <td className="py-3 px-4 text-center">
                        {isPurchase ? (
                          doc.isStockUpdated ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] gap-1">
                              <CheckCircle2 className="size-3" /> เพิ่มสต็อกแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              ยังไม่เพิ่มสต็อก
                            </Badge>
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            - ไม่กระทบสต็อก -
                          </span>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-foreground text-sm">
                          ฿{doc.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          VAT: ฿
                          {doc.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1"
                            onClick={() => setSelectedExpense(doc)}
                          >
                            <Eye className="size-3.5 text-primary" /> ดูข้อมูล
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8 rounded-lg">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuLabel>จัดการบิลรายจ่าย</DropdownMenuLabel>
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => setSelectedExpense(doc)}
                              >
                                <Eye className="size-3.5" /> ดูรายละเอียดบิล
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 text-rose-600 dark:text-rose-400"
                                onClick={() => handleDelete(doc.id, doc.docNumber)}
                              >
                                <Trash2 className="size-3.5" /> ลบเอกสารนี้
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OCR MODAL */}
      {ocrModalOpen && (
        <ReceiptOcrModal
          open={ocrModalOpen}
          initialType={ocrInitialType}
          onClose={() => setOcrModalOpen(false)}
          onSaved={(newDoc) => {
            loadExpenses();
            setSelectedExpense(newDoc);
          }}
        />
      )}

      {/* DETAIL MODAL */}
      {selectedExpense && (
        <ExpenseDetailModal
          document={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onDeleted={loadExpenses}
        />
      )}
    </div>
  );
}
