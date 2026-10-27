#!/usr/bin/env python3
from pathlib import Path

path = Path("src/routes/settings.tsx")
t = path.read_text()

old_toast = """        if (result.activeBackend === "cloudsql") {
          toast.success(
            `เชื่อมต่อ Cloud SQL สำเร็จ! (พบ ${result.counts.zones} โซน, ${result.counts.categories} หมวดหมู่หลัก, ${result.counts.subCategories} หมวดหมู่ย่อย, ${result.counts.units} หน่วยนับ)`,
          );
        } else if (result.activeBackend === "d1") {"""
new_toast = """        if (result.activeBackend === "d1") {"""
if old_toast not in t:
    raise SystemExit("toast block not found")
t = t.replace(old_toast, new_toast)

old_badge = """                  {dbInspection?.activeBackend === "cloudsql" ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] gap-1 font-semibold">
                      <span className="size-1.5 rounded-full bg-white animate-pulse" /> Cloud SQL
                      ต่อติด
                    </Badge>
                  ) : dbInspection?.activeBackend === "d1" ? (
                    <Badge className="bg-blue-600 text-white text-[10px] gap-1 font-semibold">
                      <span className="size-1.5 rounded-full bg-white" /> Cloudflare D1
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700 dark:text-amber-300 text-[10px] bg-background"
                    >
                      Memory Snapshot (.data)
                    </Badge>
                  )}"""
new_badge = """                  {dbInspection?.activeBackend === "d1" ? (
                    <Badge className="bg-blue-600 text-white text-[10px] gap-1 font-semibold">
                      <span className="size-1.5 rounded-full bg-white" /> Cloudflare D1
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700 dark:text-amber-300 text-[10px] bg-background"
                    >
                      Memory Snapshot (.data)
                    </Badge>
                  )}"""
if old_badge not in t:
    raise SystemExit("badge block not found")
t = t.replace(old_badge, new_badge)

if "cloudsql" in t.lower():
    raise SystemExit("cloudsql still present after strip")

path.write_text(t)
print("stripped ok", path.stat().st_size)
