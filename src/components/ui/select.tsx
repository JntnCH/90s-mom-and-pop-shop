"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  registerOption: (option: SelectOption) => void;
  unregisterOption: (value: string) => void;
  setPlaceholder: (p: string) => void;
  setTriggerClassName: (cls: string) => void;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

function useSelectContext() {
  return React.useContext(SelectContext);
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props && props.children) {
      return extractText(props.children);
    }
  }
  return "";
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  children?: React.ReactNode;
  className?: string;
}

export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled,
  name,
  children,
  className,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");
  const [dynamicPlaceholder, setDynamicPlaceholder] = React.useState<string>("");
  const [dynamicTriggerClass, setDynamicTriggerClass] = React.useState<string>("");
  const [dynamicOptions, setDynamicOptions] = React.useState<SelectOption[]>([]);

  // Synchronously extract initial options and props from children tree
  const { initialPlaceholder, initialTriggerClass, initialOptions } = React.useMemo(() => {
    let initialPlaceholder = "";
    let initialTriggerClass = "";
    const initialOptions: SelectOption[] = [];

    function walk(node: React.ReactNode) {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (React.isValidElement(node)) {
        const props = node.props as Record<string, unknown>;
        if (props) {
          if ("value" in props && typeof props.value === "string" && !("onValueChange" in props)) {
            initialOptions.push({
              value: props.value,
              label: extractText(props.children as React.ReactNode) || props.value,
              disabled: Boolean(props.disabled),
            });
          }
          if (props.placeholder && !initialPlaceholder) {
            initialPlaceholder = String(props.placeholder);
          }
          if (
            props.className &&
            !initialTriggerClass &&
            (node.type === SelectTrigger ||
              (node.type as { displayName?: string })?.displayName === "SelectTrigger")
          ) {
            initialTriggerClass = String(props.className);
          }
          if (props.children) {
            walk(props.children as React.ReactNode);
          }
        }
      }
    }

    walk(children);
    return { initialPlaceholder, initialTriggerClass, initialOptions };
  }, [children]);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = React.useCallback(
    (newVal: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newVal);
      }
      onValueChange?.(newVal);
    },
    [controlledValue, onValueChange],
  );

  const registerOption = React.useCallback((opt: SelectOption) => {
    setDynamicOptions((prev) => {
      const idx = prev.findIndex((p) => p.value === opt.value);
      if (idx >= 0) {
        if (prev[idx].label === opt.label && prev[idx].disabled === opt.disabled) {
          return prev;
        }
        const next = [...prev];
        next[idx] = opt;
        return next;
      }
      return [...prev, opt];
    });
  }, []);

  const unregisterOption = React.useCallback((val: string) => {
    setDynamicOptions((prev) => prev.filter((p) => p.value !== val));
  }, []);

  const contextValue = React.useMemo<SelectContextType>(
    () => ({
      value,
      onValueChange: handleValueChange,
      disabled,
      setPlaceholder: setDynamicPlaceholder,
      setTriggerClassName: setDynamicTriggerClass,
      registerOption,
      unregisterOption,
    }),
    [value, handleValueChange, disabled, registerOption, unregisterOption],
  );

  // Combine synchronous and dynamically registered options
  const mergedOptions = React.useMemo(() => {
    const map = new Map<string, SelectOption>();
    for (const opt of initialOptions) {
      map.set(opt.value, opt);
    }
    for (const opt of dynamicOptions) {
      map.set(opt.value, opt);
    }
    return Array.from(map.values());
  }, [initialOptions, dynamicOptions]);

  const effectivePlaceholder = dynamicPlaceholder || initialPlaceholder;
  const effectiveTriggerClass = dynamicTriggerClass || initialTriggerClass;

  return (
    <SelectContext.Provider value={contextValue}>
      <div style={{ display: "none" }} aria-hidden="true">
        {children}
      </div>
      <select
        name={name}
        value={value ?? ""}
        onChange={(e) => handleValueChange(e.target.value)}
        disabled={Boolean(disabled)}
        className={cn(
          "w-full rounded-xl border border-input bg-background px-3 py-2 text-base shadow-xs font-medium truncate cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
          effectiveTriggerClass,
          className,
        )}
      >
        {effectivePlaceholder && (
          <option value="" disabled hidden={Boolean(value)}>
            {effectivePlaceholder}
          </option>
        )}
        {mergedOptions.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children }, _ref) => {
    const ctx = useSelectContext();
    React.useEffect(() => {
      if (className && ctx?.setTriggerClassName) {
        ctx.setTriggerClassName(className);
      }
    }, [className, ctx]);

    return <>{children}</>;
  },
);
SelectTrigger.displayName = "SelectTrigger";

export function SelectValue({ placeholder }: { placeholder?: string; className?: string }) {
  const ctx = useSelectContext();
  React.useEffect(() => {
    if (placeholder && ctx?.setPlaceholder) {
      ctx.setPlaceholder(placeholder);
    }
  }, [placeholder, ctx]);

  return null;
}
SelectValue.displayName = "SelectValue";

export function SelectContent({
  children,
}: {
  children?: React.ReactNode;
  className?: string;
  position?: string;
}) {
  return <>{children}</>;
}
SelectContent.displayName = "SelectContent";

export function SelectItem({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const ctx = useSelectContext();
  const label = extractText(children) || value;

  React.useEffect(() => {
    ctx?.registerOption({ value, label, disabled });
    return () => {
      ctx?.unregisterOption(value);
    };
  }, [value, label, disabled, ctx]);

  return null;
}
SelectItem.displayName = "SelectItem";

export function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
SelectGroup.displayName = "SelectGroup";

export function SelectLabel({ children: _ }: { children?: React.ReactNode; className?: string }) {
  return null;
}
SelectLabel.displayName = "SelectLabel";

export function SelectSeparator() {
  return null;
}
SelectSeparator.displayName = "SelectSeparator";

export function SelectScrollUpButton() {
  return null;
}
SelectScrollUpButton.displayName = "SelectScrollUpButton";

export function SelectScrollDownButton() {
  return null;
}
SelectScrollDownButton.displayName = "SelectScrollDownButton";
