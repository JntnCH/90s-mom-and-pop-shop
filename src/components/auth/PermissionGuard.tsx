import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

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
  AuthService,
  DEFAULT_USERS,
  ROLE_DEFINITIONS,
  type RolePermissions,
  type StaffUser,
} from "@/lib/auth-rbac";

interface PermissionGuardProps {
  permission: keyof RolePermissions;
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function PermissionGuard({
  permission,
  children,
  fallbackTitle = "ต้องใช้สิทธิ์เข้าถึงเพิ่มเติม",
  fallbackDescription = "บัญชีปัจจุบันของคุณไม่มีสิทธิ์ในการเข้าถึงหรือแก้ไขหน้านี้",
}: PermissionGuardProps) {
  const [currentUser, setCurrentUser] = useState<StaffUser>(DEFAULT_USERS[0]!);
  const [isOverridden, setIsOverridden] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overridePin, setOverridePin] = useState("");

  const refreshAuth = () => {
    setCurrentUser(AuthService.getCurrentUser());
    setIsOverridden(false);
  };

  useEffect(() => {
    refreshAuth();
    const handleAuthChange = () => refreshAuth();
    window.addEventListener("minimark_auth_change", handleAuthChange);
    return () => window.removeEventListener("minimark_auth_change", handleAuthChange);
  }, []);

  const hasAccess = isOverridden || AuthService.hasPermission(permission, currentUser);

  if (hasAccess) {
    return <>{children}</>;
  }

  const roleDef = ROLE_DEFINITIONS[currentUser.role];

  const handleAdminOverride = () => {
    const result = AuthService.verifyAdminOverride(overridePin);
    if (result.success && result.user) {
      setIsOverridden(true);
      setOverrideModalOpen(false);
      toast.success(
        `ปลดล็อกสิทธิ์ชั่วคราวสำเร็จด้วยรหัสของ ${result.user.name} (${result.user.role})`,
      );
    } else {
      toast.error("รหัส PIN สำหรับปลดล็อกไม่ถูกต้อง (ต้องเป็นรหัส Admin หรือ Manager)");
    }
  };

  return (
    <div className="py-8 px-4 flex flex-col items-center justify-center max-w-lg mx-auto">
      <Card className="w-full rounded-2xl border-amber-500/30 bg-card shadow-lg overflow-hidden text-center">
        <div className="bg-amber-500/10 p-6 flex flex-col items-center justify-center border-b border-amber-500/20">
          <div className="size-16 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600 mb-2">
            <Lock className="size-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground mt-2">{fallbackTitle}</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">{fallbackDescription}</p>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="p-3 rounded-xl border bg-muted/40 text-xs text-left space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ผู้ใช้งานปัจจุบัน:</span>
              <span className="font-semibold text-foreground">{currentUser.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">บทบาท (Role):</span>
              <Badge variant="outline" className={`text-[10px] font-medium ${roleDef.badgeColor}`}>
                {roleDef.icon} {roleDef.name}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">สิทธิ์ที่ต้องการ:</span>
              <span className="font-mono text-primary font-bold text-[11px]">{permission}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="h-10 text-xs font-semibold rounded-xl flex-1 gap-1.5 bg-primary text-primary-foreground"
              onClick={() => {
                setOverridePin("");
                setOverrideModalOpen(true);
              }}
            >
              <KeyRound className="size-4" /> ปลดล็อกด้วย PIN ผู้จัดการ (Admin Override)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OVERRIDE PIN MODAL */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              ปลดล็อกสิทธิ์ชั่วคราว (Admin Override)
            </DialogTitle>
            <DialogDescription className="text-xs">
              กรอกรหัส PIN ของเจ้าของร้าน (Admin) หรือผู้จัดการ (Manager) เพื่อเข้าใช้งาน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">รหัส PIN 4 หลัก *</Label>
              <Input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="กรอก PIN เช่น 1234 หรือ 5678"
                className="h-11 text-center font-mono text-lg tracking-widest rounded-xl"
                value={overridePin}
                onChange={(e) => setOverridePin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdminOverride();
                }}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                (ตัวอย่าง: Admin = 1234, Manager = 5678)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl"
              onClick={() => setOverrideModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-10 text-xs font-semibold rounded-xl bg-primary text-primary-foreground"
              onClick={handleAdminOverride}
            >
              ปลดล็อกสิทธิ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
