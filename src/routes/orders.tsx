import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [{ title: "รายการสั่งซื้อ — โชห่วยยุค90s" }],
  }),
  component: OrdersRedirectPage,
});

function OrdersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.navigate({ to: "/reorder" });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          กำลังเปลี่ยนเส้นทางไปยังหน้ารายการสั่งซื้อ...
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          หากหน้าไม่เปลี่ยนแปลง ให้คลิกปุ่มด้านล่าง
        </p>
        <div className="mt-4">
          <Link
            to="/reorder"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            ไปยังหน้ารายการสั่งซื้อ
          </Link>
        </div>
      </div>
    </div>
  );
}
