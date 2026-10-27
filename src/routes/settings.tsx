import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { GoogleSheetsSyncTab } from "@/components/sheets/GoogleSheetsSyncTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDatabaseInspectionFn,
  type DatabaseInspectionResult,
} from "@/lib/line-server-fn";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ & ฐานข้อมูล | โชห่วยยุค90s" },
      {
        name: "description",
        content: "สถานะฐานข้อมูล D1 และ Google Sheets (ไม่ใช้ Cloud SQL)",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("database");
  const [dbInspection, setDbInspection] = useState<DatabaseInspectionResult | null>(null);
  const [isLoadingDbInspection, setIsLoadingDbInspection] = useState(false);

  const checkDatabaseStatus = useCallback(async (showToast = false) => {
    setIsLoadingDbInspection(true);
    try {
      const result = await getDatabaseInspectionFn();
      setDbInspection(result);
      if (showToast) {
        if (result.activeBackend === "d1") {
          toast.success(
            `เชื่อมต่อ Cloudflare D1 สำเร็จ! (สินค้า ${result.counts.products}, โซน ${result.counts.zones})`,
          );
        } else {
          toast.info("ทำงานในโหมด Memory Snapshot (ยังไม่ถึง D1)");
        }
      }
      return result;
    } catch (err) {
      console.warn("Database inspection failed:", err);
      if (showToast) toast.error("ไม่สามารถตรวจสอบสถานะฐานข้อมูลได้");
      return null;
    } finally {
      setIsLoadingDbInspection(false);
    }
  }, []);

  useEffect(() => {
    void checkDatabaseStatus(false);
  }, [checkDatabaseStatus]);

  return (
    <PermissionGuard>
      <div className="container max-w-5xl py-6 space-y-6">
        <PageHeader
          title="ตั้งค่าระบบ & ฐานข้อมูล"
          description="ฐานข้อมูลหลัก: Cloudflare D1 + Google Sheets (ไม่ใช้ Cloud SQL)"
        />

        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Database className="size-4 text-emerald-600" />
                  <CardTitle className="text-base font-bold">สถานะฐานข้อมูล</CardTitle>
                  {dbInspection?.activeBackend === "d1" ? (
                    <Badge className="bg-blue-600 text-white text-[10px]">Cloudflare D1</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-[10px]">
                      Memory Snapshot
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {dbInspection
                    ? `${dbInspection.backendLabel} · host: ${dbInspection.databaseHost}`
                    : "กำลังตรวจสอบ..."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={isLoadingDbInspection}
                onClick={() => void checkDatabaseStatus(true)}
              >
                <RefreshCw className={`size-3.5 ${isLoadingDbInspection ? "animate-spin" : ""}`} />
                ตรวจสอบอีกครั้ง
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-muted-foreground text-xs">โซน</div>
              <div className="font-semibold">{dbInspection?.counts.zones ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">หมวดหมู่</div>
              <div className="font-semibold">{dbInspection?.counts.categories ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">หน่วยนับ</div>
              <div className="font-semibold">{dbInspection?.counts.units ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">สินค้า</div>
              <div className="font-semibold">{dbInspection?.counts.products ?? "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="database">ฐานข้อมูล</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          </TabsList>
          <TabsContent value="database" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">สถาปัตยกรรมปัจจุบัน</CardTitle>
                <CardDescription>
                  ลบ Cloud SQL ออกแล้ว — ใช้ Cloudflare D1 เป็น Primary และ Google Sheets สำหรับ sync/backup
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  หน้า Settings เวอร์ชันเต็ม (โซน / หมวด / ผู้ติดตาม LINE / Flex) กำลังกู้คืนแยกต่างหาก
                  เนื่องจากขนาดไฟล์เดิมใหญ่เกินขีดจำกัดของเครื่องมืออัปโหลดครั้งนี้
                </p>
                <p>
                  ไฟล์เต็มที่ตัด Cloud SQL UI แล้วอยู่ที่ artifacts ของโปรเจกต์:
                  <code className="mx-1 text-xs">restore/settings.FULL.tsx</code>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sheets" className="mt-4">
            <GoogleSheetsSyncTab />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
