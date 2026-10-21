import { Barcode as BarcodeIcon, QrCode } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  MasterStore,
  type CategoryItem,
  type SubCategoryItem,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export interface SelectProps {
  value?: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  includeAll?: boolean | undefined;
  allLabel?: string | undefined;
}

/**
 * 1. โซนสินค้า (Zone)
 */
export function ZoneSelect({
  value,
  onChange,
  placeholder = "เลือกโซนจัดเก็บ",
  disabled,
  className,
  includeAll = false,
  allLabel = "ทุกโซนจัดเก็บ",
}: SelectProps) {
  const [zones, setZones] = useState<ZoneItem[]>([]);

  const load = () => setZones(MasterStore.getZones());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const isFilter = includeAll || (placeholder && placeholder.startsWith("ทุก"));

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={Boolean(disabled)}
      className={cn(
        "w-full rounded-xl border border-input bg-background px-3 py-2 text-base shadow-xs font-medium truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {placeholder && (
        <option value="" disabled={!isFilter}>
          {isFilter ? `🌐 ${allLabel || placeholder}` : placeholder}
        </option>
      )}
      {zones.map((z) => (
        <option key={z.id} value={z.id}>
          📍 {z.code ? `${z.code} - ` : ""}
          {z.name}
        </option>
      ))}
    </select>
  );
}

/**
 * 2. หมวดหมู่หลัก (Main Category)
 */
export function CategorySelect({
  value,
  onChange,
  placeholder = "เลือกหมวดหมู่หลัก",
  disabled,
  className,
  includeAll = false,
  allLabel = "ทุกหมวดหมู่หลัก",
}: SelectProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const load = () => setCategories(MasterStore.getCategories());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const isFilter = includeAll || (placeholder && placeholder.startsWith("ทุก"));

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={Boolean(disabled)}
      className={cn(
        "w-full rounded-xl border border-input bg-background px-3 py-2 text-base shadow-xs font-medium truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {placeholder && (
        <option value="" disabled={!isFilter}>
          {isFilter ? `📁 ${allLabel || placeholder}` : placeholder}
        </option>
      )}
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          🏷️ {c.name} {c.code ? `(${c.code})` : ""}
        </option>
      ))}
    </select>
  );
}

export { CategorySelect as MainCategorySelect };

/**
 * 3. หมวดหมู่ย่อย (Sub Category)
 */
export interface SubCategorySelectProps extends SelectProps {
  categoryId?: string | undefined;
  includeAll?: boolean | undefined;
  allLabel?: string | undefined;
  includeNone?: boolean | undefined;
  noneLabel?: string | undefined;
}

export function SubCategorySelect({
  value,
  onChange,
  categoryId,
  placeholder = "เลือกหมวดหมู่ย่อย",
  disabled,
  className,
  includeAll = false,
  allLabel = "ทุกหมวดหมู่ย่อย",
  includeNone = true,
  noneLabel = "ไม่ระบุหมวดหมู่ย่อย",
}: SubCategorySelectProps) {
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([]);

  useEffect(() => {
    const load = () => setSubCategories(MasterStore.getSubCategories(categoryId));
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, [categoryId]);

  const isFilter = includeAll || (placeholder && placeholder.startsWith("ทุก"));

  return (
    <select
      value={value === "none" ? "none" : value || (isFilter ? "" : "none")}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "none") {
          onChange?.("");
        } else {
          onChange?.(val);
        }
      }}
      disabled={Boolean(disabled)}
      className={cn(
        "w-full rounded-xl border border-input bg-background px-3 py-2 text-base shadow-xs font-medium truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {isFilter && <option value="">🌐 {allLabel || placeholder}</option>}
      {!isFilter && includeNone && <option value="none">⚪ {noneLabel}</option>}
      {subCategories.length === 0 && !isFilter && !includeNone && (
        <option value="" disabled>
          ไม่มีหมวดหมู่ย่อยในหมวดนี้
        </option>
      )}
      {subCategories.map((s) => (
        <option key={s.id} value={s.id}>
          › {s.name} {s.code ? `(${s.code})` : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * 4. หน่วยนับ (Unit)
 */
export function UnitSelect({
  value,
  onChange,
  placeholder = "เลือกหน่วยนับ",
  disabled,
  className,
  includeAll = false,
  allLabel = "ทุกหน่วยนับ",
}: SelectProps) {
  const [units, setUnits] = useState<UnitItem[]>([]);

  const load = () => setUnits(MasterStore.getUnits());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const isFilter = includeAll || (placeholder && placeholder.startsWith("ทุก"));

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={Boolean(disabled)}
      className={cn(
        "w-full rounded-xl border border-input bg-background px-3 py-2 text-base shadow-xs font-medium truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {placeholder && (
        <option value="" disabled={!isFilter}>
          {isFilter ? `📦 ${allLabel || placeholder}` : placeholder}
        </option>
      )}
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          📦 {u.name}
        </option>
      ))}
    </select>
  );
}

export function FormatBadge({
  type,
  format,
  className,
}: {
  type?: "QR" | "Barcode" | undefined;
  format?: string | undefined;
  className?: string | undefined;
}) {
  const isQr = type === "QR" || format?.toUpperCase().includes("QR");

  if (isQr) {
    return (
      <Badge
        variant="outline"
        className={`bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 font-medium text-xs ${className ?? ""}`}
      >
        <QrCode className="size-3" />
        QR Code
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 gap-1 font-medium text-xs ${className ?? ""}`}
    >
      <BarcodeIcon className="size-3" />
      Barcode {format ? `(${format})` : ""}
    </Badge>
  );
}
