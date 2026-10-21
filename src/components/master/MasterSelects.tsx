import { Barcode as BarcodeIcon, QrCode } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MasterStore,
  type CategoryItem,
  type SubCategoryItem,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";
import { cn } from "@/lib/utils";

interface SelectProps {
  value?: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
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
}: SelectProps) {
  const [zones, setZones] = useState<ZoneItem[]>([]);

  const load = () => setZones(MasterStore.getZones());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const cleanClassName = className ? className.replace(/\btext-(?:xs|sm)\b/g, "").trim() : "";

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={Boolean(disabled)}>
      <SelectTrigger
        className={cn(
          "text-base min-w-0 overflow-hidden [&>span]:truncate [&>span]:block [&>span]:max-w-full",
          cleanClassName,
          "text-base",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto overflow-x-hidden min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
        {zones.map((z) => (
          <SelectItem
            key={z.id}
            value={z.id}
            className="text-base py-2.5 font-medium leading-normal cursor-pointer overflow-hidden"
          >
            <span className="truncate block max-w-full">{z.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
}: SelectProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const load = () => setCategories(MasterStore.getCategories());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const cleanClassName = className ? className.replace(/\btext-(?:xs|sm)\b/g, "").trim() : "";

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={Boolean(disabled)}>
      <SelectTrigger
        className={cn(
          "text-base min-w-0 overflow-hidden [&>span]:truncate [&>span]:block [&>span]:max-w-full",
          cleanClassName,
          "text-base",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto overflow-x-hidden min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
        {categories.map((c) => (
          <SelectItem
            key={c.id}
            value={c.id}
            className="text-base py-2.5 font-medium leading-normal cursor-pointer overflow-hidden"
          >
            <span className="truncate block max-w-full">
              {c.name} ({c.code})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

  const cleanClassName = className ? className.replace(/\btext-(?:xs|sm)\b/g, "").trim() : "";

  return (
    <Select
      value={
        value === "" || value === undefined
          ? includeAll
            ? "all"
            : includeNone
              ? "none"
              : ""
          : value
      }
      onValueChange={(val) => {
        if (val === "none") {
          onChange?.("");
        } else {
          onChange?.(val);
        }
      }}
      disabled={Boolean(disabled)}
    >
      <SelectTrigger
        className={cn(
          "text-base min-w-0 overflow-hidden [&>span]:truncate [&>span]:block [&>span]:max-w-full",
          cleanClassName,
          "text-base",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto overflow-x-hidden min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
        {includeAll && (
          <SelectItem
            value="all"
            className="text-base py-2.5 font-medium leading-normal cursor-pointer overflow-hidden text-primary"
          >
            <span className="truncate block max-w-full">🌐 {allLabel}</span>
          </SelectItem>
        )}
        {includeNone && !includeAll && (
          <SelectItem
            value="none"
            className="text-base py-2 font-normal text-muted-foreground leading-normal cursor-pointer overflow-hidden"
          >
            <span className="truncate block max-w-full">⚪ {noneLabel}</span>
          </SelectItem>
        )}
        {subCategories.length === 0 && !includeAll && !includeNone && (
          <div className="py-3 px-3 text-xs text-center text-muted-foreground">
            ไม่มีหมวดหมู่ย่อยในหมวดนี้
          </div>
        )}
        {subCategories.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
            className="text-base py-2.5 font-medium leading-normal cursor-pointer overflow-hidden"
          >
            <span className="truncate block max-w-full">
              › {s.name} ({s.code})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
}: SelectProps) {
  const [units, setUnits] = useState<UnitItem[]>([]);

  const load = () => setUnits(MasterStore.getUnits());

  useEffect(() => {
    load();
    window.addEventListener("minimark_store_change", load);
    return () => window.removeEventListener("minimark_store_change", load);
  }, []);

  const cleanClassName = className ? className.replace(/\btext-(?:xs|sm)\b/g, "").trim() : "";

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={Boolean(disabled)}>
      <SelectTrigger
        className={cn(
          "text-base min-w-0 overflow-hidden [&>span]:truncate [&>span]:block [&>span]:max-w-full",
          cleanClassName,
          "text-base",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto overflow-x-hidden min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
        {units.map((u) => (
          <SelectItem
            key={u.id}
            value={u.id}
            className="text-base py-2.5 font-medium leading-normal cursor-pointer overflow-hidden"
          >
            <span className="truncate block max-w-full">{u.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
