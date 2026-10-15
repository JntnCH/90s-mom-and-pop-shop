import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Filter,
  History,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { FormatBadge } from "@/components/master/MasterSelects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { MasterStore, type ReceiveItem, type StockMovementLog } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "ประวัติรายการ & Movement Log | โชห่วยยุค90s" },
      {
        name: "description",
        content:
          "ประวัติความเคลื่อนไหวสต็อกสินค้า (Stock Movement) รับเข้า จ่ายออก ปรับยอด และประวัติการสแกน",
      },
      { property: "og:title", content: "ประวัติรายการ & Movement Log | โชห่วยยุค90s" },
      { property: "og:description", content: "ประวัติรายการความเคลื่อนไหวสต็อกสินค้า" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [activeTab, setActiveTab] = useState("movements");
  const [movements, setMovements] = useState<StockMovementLog[]>([]);
  const [receives, setReceives] = useState<ReceiveItem[]>([]);

  // Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    "ALL" | "RECEIVE" | "ISSUE" | "ADJUST"
  >("ALL");

  const loadData = () => {
    setMovements(MasterStore.getMovements());
    setReceives(MasterStore.getReceives());
  };

  useEffect(() => {
    loadData();
    window.addEventListener("minimark_store_change", loadData);
    return () => window.removeEventListener("minimark_store_change", loadData);
  }, []);

  const handleClearReceives = () => {
    if (confirm("ต้องการล้างประวัติการสแกนรับสินค้าทั้งหมดใช่หรือไม่?")) {
      MasterStore.clearReceives();
    }
  };

  const handleClearMovements = () => {
    if (confirm("ต้องการล้างประวัติความเคลื่อนไหวสต็อกทั้งหมดใช่หรือไม่?")) {
      MasterStore.clearMovements();
    }
  };

  const filteredMovements = movements.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.productName.toLowerCase().includes(q) ||
      m.barcode.toLowerCase().includes(q) ||
      m.operator.toLowerCase().includes(q) ||
      (m.note && m.note.toLowerCase().includes(q));

    const matchesType = movementTypeFilter === "ALL" || m.type === movementTypeFilter;

    return matchesSearch && matchesType;
  });

  const receiveMovementsCount = movements.filter((m) => m.type === "RECEIVE").length;
  const issueMovementsCount = movements.filter((m) => m.type === "ISSUE").length;
  const adjustMovementsCount = movements.filter((m) => m.type === "ADJUST").length;

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="size-6 text-primary" /> ประวัติรายการ & Stock Movement (Phase 3)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            บันทึกประวัติความเคลื่อนไหวสต็อกสินค้าทุกครั้งที่มีการรับเข้า, จ่ายออก หรือปรับปรุงยอด
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "movements" && movements.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearMovements}
              className="h-10 sm:h-9 text-xs rounded-xl gap-1.5"
            >
              <Trash2 className="size-4 text-destructive" /> ล้างประวัติ Movement
            </Button>
          )}
          {activeTab === "scans" && receives.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearReceives}
              className="h-10 sm:h-9 text-xs rounded-xl gap-1.5"
            >
              <Trash2 className="size-4 text-destructive" /> ล้างประวัติสแกน
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md h-auto p-1.5 rounded-2xl bg-muted gap-1">
          <TabsTrigger
            value="movements"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl"
          >
            <History className="size-4 mr-1.5" /> ความเคลื่อนไหวสต็อก ({movements.length})
          </TabsTrigger>
          <TabsTrigger value="scans" className="h-10 text-xs sm:text-sm font-semibold rounded-xl">
            <PackageCheck className="size-4 mr-1.5" /> ประวัติสแกนรับเข้า ({receives.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: STOCK MOVEMENTS (PHASE 3 CORE AUDIT LOG) */}
        <TabsContent value="movements" className="space-y-4">
          {/* Summary Pills */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
              <div className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                <ArrowDownRight className="size-3.5" /> รับเข้า
              </div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-600 mt-0.5">
                {receiveMovementsCount} รายการ
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
              <div className="text-[11px] text-destructive font-semibold flex items-center justify-center gap-1">
                <ArrowUpRight className="size-3.5" /> จ่ายออก
              </div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-destructive mt-0.5">
                {issueMovementsCount} รายการ
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
              <div className="text-[11px] text-blue-600 font-semibold flex items-center justify-center gap-1">
                <SlidersHorizontal className="size-3.5" /> ปรับยอด
              </div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-blue-600 mt-0.5">
                {adjustMovementsCount} รายการ
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-3 sm:p-5">
              <div className="grid gap-2.5 sm:grid-cols-12">
                <div className="relative sm:col-span-8">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด, ผู้ทำรายการ หรือ หมายเหตุ..."
                    className="pl-9 h-10 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Select
                    value={movementTypeFilter}
                    onValueChange={(val) => setMovementTypeFilter(val as typeof movementTypeFilter)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="ประเภทความเคลื่อนไหว" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทุกประเภท ({movements.length})</SelectItem>
                      <SelectItem value="RECEIVE">รับสินค้าเข้า (+)</SelectItem>
                      <SelectItem value="ISSUE">จ่ายสินค้าออก (-)</SelectItem>
                      <SelectItem value="ADJUST">ปรับปรุงยอด (±)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Cards for Stock Movements */}
          <div className="block md:hidden space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground">
                รายการประวัติ ({filteredMovements.length} / {movements.length})
              </span>
            </div>

            {filteredMovements.length === 0 ? (
              <Card className="rounded-2xl p-8 text-center text-muted-foreground">
                <History className="size-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">ไม่พบประวัติความเคลื่อนไหวตามเงื่อนไข</p>
              </Card>
            ) : (
              filteredMovements.map((m) => {
                const isReceive = m.type === "RECEIVE";
                const isIssue = m.type === "ISSUE";

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border bg-card p-3.5 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isReceive ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                            <ArrowDownRight className="size-3" /> รับเข้า (+{m.quantity})
                          </Badge>
                        ) : isIssue ? (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <ArrowUpRight className="size-3" /> จ่ายออก (-{m.quantity})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <SlidersHorizontal className="size-3" /> ปรับยอด ({m.quantity})
                          </Badge>
                        )}
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {m.barcode}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                        {m.timestamp}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-foreground line-clamp-2">
                      {m.productName}
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">สต็อก: </span>
                        <span className="font-mono font-bold text-muted-foreground">
                          {m.previousStock}
                        </span>
                        <span className="mx-1.5 text-muted-foreground">➔</span>
                        <span
                          className={`font-mono font-bold ${
                            isReceive
                              ? "text-emerald-600"
                              : isIssue
                                ? "text-destructive"
                                : "text-primary"
                          }`}
                        >
                          {m.newStock}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <User className="size-3" /> {m.operator || "ระบบ"}
                      </div>
                    </div>

                    {m.note ? (
                      <div className="text-[11px] bg-muted/60 px-2 py-1 rounded-lg text-muted-foreground">
                        หมายเหตุ: {m.note}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table for Stock Movements */}
          <Card className="hidden md:block rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-5 text-primary" /> ตารางบันทึกประวัติความเคลื่อนไหวสต็อก
                (Audit Log)
              </CardTitle>
              <CardDescription>
                บันทึกการเปลี่ยนแปลงของจำนวนสต็อกอย่างละเอียด พร้อมข้อมูลสต็อกก่อนและหลังเปลี่ยน
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">วันเวลา</TableHead>
                      <TableHead className="w-32">ประเภท</TableHead>
                      <TableHead className="w-36">รหัส / บาร์โค้ด</TableHead>
                      <TableHead>สินค้า</TableHead>
                      <TableHead className="text-right w-24">จำนวน</TableHead>
                      <TableHead className="text-center w-36">สต็อกก่อน ➔ หลัง</TableHead>
                      <TableHead className="w-36">ผู้ทำรายการ</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          ไม่พบประวัติความเคลื่อนไหวสต็อก
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovements.map((m) => {
                        const isReceive = m.type === "RECEIVE";
                        const isIssue = m.type === "ISSUE";

                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {m.timestamp}
                            </TableCell>
                            <TableCell>
                              {isReceive ? (
                                <Badge className="bg-emerald-600 text-white text-[11px] gap-1">
                                  <ArrowDownRight className="size-3" /> รับเข้า
                                </Badge>
                              ) : isIssue ? (
                                <Badge variant="destructive" className="text-[11px] gap-1">
                                  <ArrowUpRight className="size-3" /> จ่ายออก
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px] gap-1">
                                  <SlidersHorizontal className="size-3" /> ปรับยอด
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">
                              {m.barcode}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {m.productName}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              <span
                                className={
                                  isReceive ? "text-emerald-600" : isIssue ? "text-destructive" : ""
                                }
                              >
                                {isReceive
                                  ? `+${m.quantity}`
                                  : isIssue
                                    ? `-${m.quantity}`
                                    : m.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className="text-muted-foreground">{m.previousStock}</span>
                              <span className="mx-1.5 text-muted-foreground font-sans">➔</span>
                              <span
                                className={`font-bold ${
                                  isReceive
                                    ? "text-emerald-600"
                                    : isIssue
                                      ? "text-destructive"
                                      : "text-primary"
                                }`}
                              >
                                {m.newStock}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.operator || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.note || "-"}
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
        </TabsContent>

        {/* TAB 2: SCANNED RECEIVES */}
        <TabsContent value="scans" className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PackageCheck className="size-5 text-emerald-600" />
                รายการตรวจรับสินค้าล่าสุด ({receives.length} รายการ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">วันเวลาที่สแกน</TableHead>
                      <TableHead className="w-32">ประเภทสแกน</TableHead>
                      <TableHead className="w-40">รหัส / บาร์โค้ด</TableHead>
                      <TableHead>ชื่อสินค้า</TableHead>
                      <TableHead className="text-right w-32">จำนวนที่รับ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receives.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          ยังไม่มีประวัติการสแกนรับสินค้า
                        </TableCell>
                      </TableRow>
                    ) : (
                      receives.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {rec.scannedAt}
                          </TableCell>
                          <TableCell>
                            <FormatBadge type={rec.codeType} format={rec.format} />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {rec.barcode}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {rec.productName}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">
                            +{rec.quantity} {rec.unit}
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
      </Tabs>
    </div>
  );
}
