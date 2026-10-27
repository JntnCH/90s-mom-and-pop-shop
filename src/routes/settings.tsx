import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="container max-w-3xl py-8 space-y-4">
      <PageHeader title="ตั้งค่าระบบ" description="กำลังกู้คืนหน้า settings หลังลบ Cloud SQL" />
      <Card>
        <CardHeader>
          <CardTitle>กำลังกู้คืนไฟล์ settings เต็ม</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Backend ใช้ Cloudflare D1 เป็นฐานข้อมูลหลัก + Google Sheets แล้ว
            (ลบ Cloud SQL ออกจาก workflow และ server fn แล้ว)
          </p>
          <p>
            หน้า settings เวอร์ชันเต็มจะถูก restore ในขั้นตอนถัดไป
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
