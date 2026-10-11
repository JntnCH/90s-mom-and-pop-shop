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
}

export function SubCategorySelect({
  value,
  onChange,
  categoryId,
  placeholder = "เลือกหมวดหมู่ย่อย",
  disabled,
  className,
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
        {subCategories.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
            className="text-base py-2.5 font-medium leading-normal cursor-pointer overflow-hidden"
          >
            <span className="truncate block max-w-full">
              {s.name} ({s.code})
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
