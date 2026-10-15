import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ScanLine, Store } from "lucide-react";
import { useState, type ReactNode } from "react";

import { UserSwitcher } from "@/components/auth/UserSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { mobileNavItems, navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Store className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold text-foreground">MiniMark</span>
        <span className="block text-xs text-muted-foreground">ระบบจัดการร้านโชว์ห่วย</span>
      </span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1.5 px-3 pb-8">
      {navItems.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex min-h-[46px] items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors active:scale-[0.98]",
              active
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:bg-muted",
            )}
          >
            <item.icon className="size-5 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden w-72 shrink-0 border-r bg-sidebar lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto flex flex-col justify-between">
          <div>
            <Brand />
            <NavList />
          </div>
          <div className="p-3 border-t bg-muted/20">
            <div className="text-[11px] text-muted-foreground font-semibold mb-1 px-1">
              ผู้ใช้งานปัจจุบัน:
            </div>
            <UserSwitcher />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top App Bar (Thumb-Zone Friendly: ~52px) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl text-foreground hover:bg-muted active:scale-95"
                  aria-label="เปิดเมนูทั้งหมด"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[85vw] max-w-xs bg-sidebar p-0 flex flex-col justify-between"
              >
                <div>
                  <Brand />
                  <NavList onNavigate={() => setOpen(false)} />
                </div>
                <div className="p-3 border-t">
                  <UserSwitcher />
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-4" />
              </span>
              <span className="text-base font-bold text-foreground">MiniMark</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <UserSwitcher />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 px-2.5 sm:px-3 gap-1 rounded-xl border-primary/30 text-xs font-semibold text-primary active:scale-95"
            >
              <Link to="/scan">
                <ScanLine className="size-4" />
                <span className="hidden sm:inline">สแกนด่วน</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* Desktop Header bar with User Switcher */}
        <header className="hidden lg:flex h-14 items-center justify-end px-8 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <UserSwitcher />
          </div>
        </header>

        {/* Scrollable Page Body with Mobile-First padding & safe area */}
        <main className="flex-1 px-3 py-3.5 sm:px-5 sm:py-5 lg:px-8 lg:py-6 pb-28 sm:pb-32 lg:pb-12 max-w-full overflow-x-hidden">
          {children}
        </main>

        {/* Mobile Fixed Bottom Navigation Bar (Natural Thumb Zone) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-lg lg:hidden">
          <div className="grid grid-cols-5 items-center px-1">
            {mobileNavItems.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const isCenterScan = item.to === "/scan";

              if (isCenterScan) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex flex-col items-center justify-center -mt-3 group"
                  >
                    <div
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full shadow-md transition-all active:scale-90",
                        active
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      <item.icon className="size-6" />
                    </div>
                    <span className="mt-1 text-[10px] font-semibold text-primary line-clamp-1">
                      {item.label}
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95",
                    active
                      ? "text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("size-5 transition-transform", active && "scale-110")} />
                  <span className="mt-0.5 text-[10px] tracking-tight line-clamp-1">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
