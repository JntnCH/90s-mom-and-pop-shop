import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AuthService,
  ROLE_DEFINITIONS,
  type RolePermissions,
  type StaffUser,
  type UserRole,
} from "@/lib/auth-rbac";

export function StaffManagementTab() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [currentUser, setCurrentUser] = useState<StaffUser>(AuthService.getCurrentUser());

  // Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("CASHIER");
  const [formPhone, setFormPhone] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [showPins, setShowPins] = useState(false);

  const loadData = () => {
    setUsers(AuthService.getUsers());
    setCurrentUser(AuthService.getCurrentUser());
  };

  useEffect(() => {
    loadData();
    const handleAuthChange = () => loadData();
    window.addEventListener("minimark_auth_change", handleAuthChange);
    return () => window.removeEventListener("minimark_auth_change", handleAuthChange);
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormName("");
    setFormUsername("");
    setFormPin("1234");
    setFormRole("CASHIER");
    setFormPhone("");
    setFormIsActive(true);
    setUserModalOpen(true);
  };

  const handleOpenEdit = (user: StaffUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPin(user.pin);
    setFormRole(user.role);
    setFormPhone(user.phone || "");
    setFormIsActive(user.isActive);
    setUserModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!formName.trim() || !formUsername.trim()) {
      toast.error("กรุณาระบุชื่อ-นามสกุล และชื่อผู้ใช้งาน");
      return;
    }

    if (!formPin.trim() || formPin.trim().length < 4) {
      toast.error("รหัส PIN ต้องมีความยาวอย่างน้อย 4 หลัก");
      return;
    }

    const phone = formPhone.trim();
    const lastLoginAt = editingUser?.lastLoginAt;
    const userData: StaffUser = {
      id: editingUser?.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: formName.trim(),
      username: formUsername.trim().toLowerCase(),
      pin: formPin.trim(),
      role: formRole,
      ...(phone ? { phone } : {}),
      isActive: formIsActive,
      ...(lastLoginAt !== undefined ? { lastLoginAt } : {}),
    };

    AuthService.saveUser(userData);
    setUserModalOpen(false);
    toast.success(editingUser ? "บันทึกข้อมูลพนักงานเรียบร้อย" : "เพิ่มพนักงานใหม่สำเร็จ");
    loadData();
  };

  const handleDeleteUser = (user: StaffUser) => {
    if (user.id === currentUser.id) {
      toast.error("ไม่สามารถลบบัญชีผู้ใช้งานที่กำลังล็อกอินอยู่ได้");
      return;
    }
    if (confirm(`ต้องการลบพนักงาน "${user.name}" ออกจากระบบใช่หรือไม่?`)) {
      AuthService.deleteUser(user.id);
      toast.success("ลบพนักงานเรียบร้อยแล้ว");
      loadData();
    }
  };

  const permissionList: { key: keyof RolePermissions; label: string; desc: string }[] = [
    { key: "canViewDashboard", label: "ดูภาพรวมยอดขาย & สถิติ", desc: "เข้าถึงแดชบอร์ดหลัก" },
    { key: "canManageProducts", label: "จัดการข้อมูลสินค้า", desc: "เพิ่ม/แก้ไข/ลบสินค้า" },
    { key: "canViewCostPrice", label: "ดูราคาต้นทุน & กำไร", desc: "แสดงต้นทุนและอัตรากำไร" },
    { key: "canEditStock", label: "ปรับยอดสต็อกสินค้า", desc: "ปรับปรุงยอดสินค้าคงเหลือ" },
    {
      key: "canReceiveGoods",
      label: "รับสินค้าเข้าคลัง (Receive)",
      desc: "ตรวจรับของจากซัพพลายเออร์",
    },
    {
      key: "canIssueGoods",
      label: "เบิก/จำหน่ายสินค้า (Issue)",
      desc: "เบิกใช้, เสียหาย, หมดอายุ",
    },
    { key: "canCreatePO", label: "สร้างใบสั่งซื้อ (PO)", desc: "ออกใบสั่งซื้อและส่ง LINE Bot" },
    {
      key: "canConfigurePrinters",
      label: "ตั้งค่าเครื่องพิมพ์",
      desc: "เพิ่ม/แก้ไขเครื่องพิมพ์และ ESC/POS",
    },
    { key: "canPrintReceipts", label: "พิมพ์สลิปใบเสร็จ", desc: "พิมพ์สลิปความร้อนหน้าร้าน" },
    {
      key: "canPrintLabels",
      label: "พิมพ์ป้ายราคา & สติกเกอร์",
      desc: "พิมพ์สติกเกอร์บาร์โค้ดติดสินค้า",
    },
    {
      key: "canAccessSettings",
      label: "เข้าถึงการตั้งค่าระบบ",
      desc: "ตั้งค่าโซน หมวดหมู่ หน่วยนับ LINE",
    },
    {
      key: "canManageUsers",
      label: "จัดการสิทธิ์พนักงาน (RBAC)",
      desc: "เพิ่ม/ลบผู้ใช้และกำหนดบทบาท",
    },
    {
      key: "canBackupRestore",
      label: "สำรอง & กู้คืนฐานข้อมูล",
      desc: "Export/Import JSON และรีเซ็ตระบบ",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Staff Management Header & List */}
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-5 text-primary" /> พนักงาน & ผู้ใช้งานในระบบ โชห่วยยุค90s
              (Phase 11)
            </CardTitle>
            <CardDescription className="text-xs">
              กำหนดบทบาทและสิทธิ์การเข้าถึงฟังก์ชันต่างๆ ของพนักงานแต่ละคนด้วยรหัส PIN 4 หลัก
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs rounded-xl gap-1.5"
              onClick={() => setShowPins(!showPins)}
            >
              {showPins ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPins ? "ซ่อน PIN" : "แสดง PIN"}
            </Button>
            <Button
              size="sm"
              className="h-9 text-xs rounded-xl font-semibold gap-1.5 shadow-sm bg-primary text-primary-foreground"
              onClick={handleOpenAdd}
            >
              <UserPlus className="size-4" /> เพิ่มพนักงานใหม่
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">ชื่อ-นามสกุล</TableHead>
                  <TableHead className="w-32">Username</TableHead>
                  <TableHead className="w-44">บทบาท (Role)</TableHead>
                  <TableHead className="w-24 text-center">รหัส PIN</TableHead>
                  <TableHead className="w-32">เบอร์ติดต่อ</TableHead>
                  <TableHead className="w-32">เข้าสู่ระบบล่าสุด</TableHead>
                  <TableHead className="w-24 text-center">สถานะ</TableHead>
                  <TableHead className="text-right w-28">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const roleDef = ROLE_DEFINITIONS[user.role];
                  const isCurrent = user.id === currentUser.id;
                  return (
                    <TableRow key={user.id} className={isCurrent ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          {user.name}
                          {isCurrent && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] px-1 py-0">
                              คุณ
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        @{user.username}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${roleDef.badgeColor}`}
                        >
                          {roleDef.icon} {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {showPins ? (
                          <span className="font-bold text-foreground">{user.pin}</span>
                        ) : (
                          <span className="text-muted-foreground tracking-widest">••••</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.phone || "-"}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {user.lastLoginAt || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-600" />
                            เปิดใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                            ระงับการใช้งาน
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(user)}
                            title="แก้ไขข้อมูล"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteUser(user)}
                            disabled={isCurrent}
                            title={isCurrent ? "ไม่สามารถลบบัญชีตัวเองได้" : "ลบพนักงาน"}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Visual Role Permissions Matrix Table */}
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" /> ตารางเมทริกซ์สิทธิ์การใช้งาน (Role
            Permissions Matrix)
          </CardTitle>
          <CardDescription className="text-xs">
            เปรียบเทียบสิทธิ์การเข้าถึงแต่ละระบบย่อยตามบทบาทหน้าที่ในร้าน โชห่วยยุค90s
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4">
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">ฟังก์ชัน / สิทธิ์การเข้าถึง</TableHead>
                  <TableHead className="text-center w-36">
                    <span className="font-bold text-red-600">👑 ADMIN</span>
                    <div className="text-[10px] text-muted-foreground font-normal">เจ้าของร้าน</div>
                  </TableHead>
                  <TableHead className="text-center w-36">
                    <span className="font-bold text-purple-600">💼 MANAGER</span>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      ผู้จัดการสาขา
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-36">
                    <span className="font-bold text-blue-600">🛒 CASHIER</span>
                    <div className="text-[10px] text-muted-foreground font-normal">แคชเชียร์</div>
                  </TableHead>
                  <TableHead className="text-center w-36">
                    <span className="font-bold text-emerald-600">📦 STOCK_STAFF</span>
                    <div className="text-[10px] text-muted-foreground font-normal">พนักงานคลัง</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionList.map((perm) => (
                  <TableRow key={perm.key}>
                    <TableCell>
                      <div className="font-semibold text-xs text-foreground">{perm.label}</div>
                      <div className="text-[10px] text-muted-foreground">{perm.desc}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {ROLE_DEFINITIONS.ADMIN.permissions[perm.key] ? (
                        <Check className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="size-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {ROLE_DEFINITIONS.MANAGER.permissions[perm.key] ? (
                        <Check className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="size-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {ROLE_DEFINITIONS.CASHIER.permissions[perm.key] ? (
                        <Check className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="size-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {ROLE_DEFINITIONS.STOCK_STAFF.permissions[perm.key] ? (
                        <Check className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="size-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ADD / EDIT STAFF MODAL */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              {editingUser ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              กำหนดบทบาทหน้าที่และรหัส PIN สำหรับใช้งานระบบ โชห่วยยุค90s
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ชื่อ-นามสกุล *</Label>
              <Input
                className="h-10 text-xs rounded-xl"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="เช่น น้องส้ม แคชเชียร์สาขา"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Username *</Label>
                <Input
                  className="h-10 font-mono text-xs rounded-xl"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="som"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">รหัส PIN (4 หลัก) *</Label>
                <Input
                  type="password"
                  maxLength={6}
                  className="h-10 font-mono text-center text-sm tracking-widest rounded-xl"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder="1234"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">บทบาทหน้าที่ (Role) *</Label>
              <Select value={formRole} onValueChange={(val: UserRole) => setFormRole(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">👑 เจ้าของร้าน / ผู้ดูแลระบบ (Admin)</SelectItem>
                  <SelectItem value="MANAGER">💼 ผู้จัดการสาขา (Store Manager)</SelectItem>
                  <SelectItem value="CASHIER">🛒 พนักงานแคชเชียร์ (Cashier)</SelectItem>
                  <SelectItem value="STOCK_STAFF">
                    📦 พนักงานคลัง & เติมสินค้า (Stock Staff)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                {ROLE_DEFINITIONS[formRole].description}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">เบอร์โทรศัพท์</Label>
              <Input
                className="h-10 text-xs rounded-xl"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="081-xxx-xxxx"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs">
                <div className="font-semibold text-foreground">สถานะการใช้งานบัญชี</div>
                <div className="text-[11px] text-muted-foreground">
                  อนุญาตให้พนักงานรายนี้เข้าสู่ระบบ
                </div>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl"
              onClick={() => setUserModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-10 text-xs font-semibold rounded-xl bg-primary text-primary-foreground"
              onClick={handleSaveUser}
            >
              บันทึกข้อมูลพนักงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
