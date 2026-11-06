import {
  Check,
  ChevronDown,
  KeyRound,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthService,
  DEFAULT_USERS,
  ROLE_DEFINITIONS,
  type StaffUser,
  type UserRole,
} from "@/lib/auth-rbac";

export function UserSwitcher() {
  const [currentUser, setCurrentUser] = useState<StaffUser>(DEFAULT_USERS[0]!);
  const [users, setUsers] = useState<StaffUser[]>(DEFAULT_USERS);

  // PIN Prompt Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<StaffUser | null>(null);
  const [enteredPin, setEnteredPin] = useState("");

  const refreshAuth = () => {
    setCurrentUser(AuthService.getCurrentUser());
    setUsers(AuthService.getUsers());
  };

  useEffect(() => {
    refreshAuth();
    const handleAuthChange = () => refreshAuth();
    window.addEventListener("minimark_auth_change", handleAuthChange);
    return () => window.removeEventListener("minimark_auth_change", handleAuthChange);
  }, []);

  const handleSelectUser = (user: StaffUser) => {
    if (user.id === currentUser.id) return;

    // If switching to ADMIN or MANAGER, prompt for PIN for security
    if (user.role === "ADMIN" || user.role === "MANAGER") {
      setTargetUser(user);
      setEnteredPin("");
      setPinModalOpen(true);
    } else {
      // Instant switch for Cashier or Stock Staff
      AuthService.setCurrentUser(user.id);
      toast.success(`สลับเข้าใช้งานเป็น "${user.name}" (${ROLE_DEFINITIONS[user.role].name})`);
    }
  };

  const handleConfirmPin = () => {
    if (!targetUser) return;
    if (enteredPin.trim() === targetUser.pin) {
      AuthService.setCurrentUser(targetUser.id);
      setPinModalOpen(false);
      toast.success(`ยืนยันตัวตนสำเร็จ: สลับเข้าใช้งานเป็น "${targetUser.name}"`);
    } else {
      toast.error("รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    }
  };

  const currentRoleDef = ROLE_DEFINITIONS[currentUser.role];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 rounded-xl border border-border/70 hover:border-primary/50 flex items-center gap-2 bg-background/80 backdrop-blur shadow-xs transition-all active:scale-95"
          >
            <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold">
              {currentRoleDef.icon}
            </div>
            <div className="flex flex-col text-left leading-none hidden sm:flex">
              <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {currentUser.role}
              </span>
            </div>
            <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-64 rounded-2xl p-2 shadow-xl border-border/80"
        >
          <DropdownMenuLabel className="p-2 pb-1.5">
            <div className="text-xs font-bold text-foreground">สลับผู้ใช้งาน (Staff Switcher)</div>
            <div className="text-[11px] text-muted-foreground font-normal">
              กำลังล็อกอินเป็น: <strong className="text-foreground">{currentUser.name}</strong>
            </div>
            <Badge
              variant="outline"
              className={`mt-1.5 text-[10px] py-0.5 w-fit font-medium ${currentRoleDef.badgeColor}`}
            >
              {currentRoleDef.icon} {currentRoleDef.name}
            </Badge>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="my-1.5" />

          <div className="space-y-1">
            {users
              .filter((u) => u.isActive)
              .map((u) => {
                const isSelected = u.id === currentUser.id;
                const rDef = ROLE_DEFINITIONS[u.role];
                return (
                  <DropdownMenuItem
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                      isSelected ? "bg-primary/10 font-bold text-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm">{rDef.icon}</span>
                      <div className="flex flex-col text-left truncate">
                        <span className="truncate">{u.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {u.role}{" "}
                          {u.role === "ADMIN" || u.role === "MANAGER" ? "• ต้องใช้ PIN" : ""}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* PIN REQUIRED MODAL */}
      <Dialog open={pinModalOpen} onOpenChange={setPinModalOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              ยืนยันรหัส PIN ผู้ใช้งาน
            </DialogTitle>
            <DialogDescription className="text-xs">
              สลับไปยังบัญชี: <strong className="text-foreground">{targetUser?.name}</strong> (
              {targetUser?.role})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">รหัส PIN 4 หลัก *</Label>
              <Input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="กรอก PIN เช่น 1234"
                className="h-11 text-center font-mono text-lg tracking-widest rounded-xl"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmPin();
                }}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                (ค่าเริ่มต้นตัวอย่าง: Admin = 1234, Manager = 5678)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl"
              onClick={() => setPinModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-10 text-xs font-semibold rounded-xl bg-primary text-primary-foreground"
              onClick={handleConfirmPin}
            >
              ยืนยันการสลับสิทธิ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
