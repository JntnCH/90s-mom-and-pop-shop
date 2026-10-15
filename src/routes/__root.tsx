import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { initLiff } from "@/lib/line-service";
import { syncMasterDatabaseFn } from "@/lib/line-server-fn";
import {
  MasterStore,
  type CategoryItem,
  type LineUserFollower,
  type ProductItem,
  type PurchaseOrderRecord,
  type StockMovementLog,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {error?.message && (
          <div className="mt-3 p-2.5 bg-destructive/10 text-destructive text-xs font-mono rounded-xl text-left break-words max-h-28 overflow-y-auto border border-destructive/20">
            {error.message}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "โชห่วยยุค90s — ระบบจัดการร้านโชว์ห่วย" },
      { name: "description", content: "จัดการสินค้า สต็อก และการสั่งซื้อสำหรับร้านโชว์ห่วย" },
      { property: "og:title", content: "โชห่วยยุค90s — ระบบจัดการร้านโชว์ห่วย" },
      {
        property: "og:description",
        content: "จัดการสินค้า สต็อก และการสั่งซื้อสำหรับร้านโชว์ห่วย",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="touch-manipulation overscroll-none antialiased" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Eagerly pre-warm LINE LIFF SDK on app load so shareTargetPicker works with instant user gesture
    initLiff().catch(() => {});

    // Initial background sync with central database (Cloud SQL)
    const runInitialSync = async () => {
      try {
        const res = await syncMasterDatabaseFn({
          data: {
            products: MasterStore.getProducts(),
            categories: MasterStore.getCategories(),
            zones: MasterStore.getZones(),
            units: MasterStore.getUnits(),
            receives: MasterStore.getReceives(),
            followers: MasterStore.getFollowers(),
            movements: MasterStore.getMovements(),
            purchaseOrders: MasterStore.getPurchaseOrders(),
          },
        });
        if (res?.success && res.data) {
          if (Array.isArray(res.data.units) && res.data.units.length > 0) {
            MasterStore.saveUnits(res.data.units as UnitItem[]);
          }
          if (Array.isArray(res.data.categories) && res.data.categories.length > 0) {
            MasterStore.saveCategories(res.data.categories as CategoryItem[]);
          }
          if (Array.isArray(res.data.zones) && res.data.zones.length > 0) {
            MasterStore.saveZones(res.data.zones as ZoneItem[]);
          }
          if (Array.isArray(res.data.products) && res.data.products.length > 0) {
            MasterStore.saveProducts(res.data.products as ProductItem[]);
          }
          if (Array.isArray(res.data.followers) && res.data.followers.length > 0) {
            MasterStore.saveFollowers(res.data.followers as LineUserFollower[]);
          }
          if (Array.isArray(res.data.movements) && res.data.movements.length > 0) {
            MasterStore.saveMovements(res.data.movements as StockMovementLog[]);
          }
          if (Array.isArray(res.data.purchaseOrders) && res.data.purchaseOrders.length > 0) {
            MasterStore.savePurchaseOrders(res.data.purchaseOrders as PurchaseOrderRecord[]);
          }
        }
      } catch (err) {
        console.warn("Central database background sync:", err);
      }
    };
    void runInitialSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </AppLayout>
      <Toaster />
    </QueryClientProvider>
  );
}
