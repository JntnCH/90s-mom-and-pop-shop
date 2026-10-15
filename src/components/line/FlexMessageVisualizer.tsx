import { Check, Code2, Copy, Download, MessageCircle, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { copyTextToClipboard, downloadJsonFile } from "@/lib/order-export";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface FlexComponentSpec {
  type: string;
  text?: string;
  size?: string;
  color?: string;
  weight?: string;
  height?: string;
  align?: string;
  wrap?: boolean;
  flex?: number;
  margin?: string;
  spacing?: string;
  layout?: "horizontal" | "vertical" | "baseline";
  backgroundColor?: string;
  paddingAll?: string;
  contents?: FlexComponentSpec[];
  action?: {
    type?: string;
    label?: string;
    text?: string;
    uri?: string;
  };
  style?: string;
  url?: string;
}

export interface FlexBubbleSpec {
  type: "bubble";
  size?: string;
  header?: {
    type: "box";
    layout: string;
    backgroundColor?: string;
    paddingAll?: string;
    contents?: FlexComponentSpec[];
  };
  body?: {
    type: "box";
    layout: string;
    backgroundColor?: string;
    contents?: FlexComponentSpec[];
  };
  footer?: {
    type: "box";
    layout: string;
    backgroundColor?: string;
    contents?: FlexComponentSpec[];
  };
}

export interface FlexMessagePayload {
  type?: string;
  altText?: string;
  contents?: FlexBubbleSpec | { contents?: FlexBubbleSpec };
}

interface FlexMessageVisualizerProps {
  flexData: unknown;
  title?: string;
  className?: string;
  onSendTest?: () => void;
}

/**
 * Universal Visual Renderer for LINE Flex Message (Bubble & Carousel)
 * Accurately replicates the LINE Messaging App UI styling.
 */
export function FlexMessageVisualizer({
  flexData,
  title = "ตัวอย่าง LINE Flex Message",
  className = "",
  onSendTest,
}: FlexMessageVisualizerProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");

  const payload = flexData as FlexMessagePayload | null;
  const bubble =
    (payload?.contents as FlexBubbleSpec)?.type === "bubble"
      ? (payload?.contents as FlexBubbleSpec)
      : ((payload?.contents as { contents?: FlexBubbleSpec })?.contents as FlexBubbleSpec) ||
        (payload as unknown as FlexBubbleSpec);

  const altText = payload?.altText || "LINE Flex Message";

  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(flexData, null, 2);
      const ok = await copyTextToClipboard(jsonStr);
      if (ok) {
        setCopied(true);
        toast.success("คัดลอก JSON สำเร็จ");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("ไม่สามารถคัดลอกได้ กรุณาใช้ปุ่มส่งออก .json");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการคัดลอก");
    }
  };

  const handleDownloadJson = () => {
    if (!flexData) return;
    const cleanTitle = (title || "flex_message")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40);
    downloadJsonFile(flexData, `${cleanTitle}.json`);
    toast.success("ดาวน์โหลดไฟล์ LINE Flex Message (.json) สำเร็จ");
  };

  return (
    <div
      className={`flex min-w-0 w-full flex-col rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col gap-2 px-3 py-3 bg-muted/50 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-[#06C755] text-white flex items-center justify-center shrink-0">
            <MessageCircle className="size-4 fill-white" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">{title}</h4>
            <p className="text-[10px] text-muted-foreground truncate">{altText}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5 sm:justify-end">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-8 p-0.5 rounded-lg bg-muted">
              <TabsTrigger value="visual" className="h-7 text-xs px-2.5 rounded-md gap-1">
                <Smartphone className="size-3" /> แสดงผล LINE
              </TabsTrigger>
              <TabsTrigger value="json" className="h-7 text-xs px-2.5 rounded-md gap-1">
                <Code2 className="size-3" /> JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs rounded-lg gap-1 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            onClick={handleDownloadJson}
            title="ดาวน์โหลดไฟล์ .json สำหรับ LINE Simulator"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">ส่งออก .json</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs rounded-lg gap-1"
            onClick={handleCopyJson}
            title="คัดลอก JSON"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span className="hidden sm:inline">คัดลอก</span>
          </Button>

          {onSendTest && (
            <Button
              size="sm"
              className="h-8 px-2.5 text-xs rounded-lg gap-1 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold shadow-xs"
              onClick={onSendTest}
            >
              <Send className="size-3" />
              <span className="hidden sm:inline">ส่งทดสอบ</span>
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {viewMode === "visual" ? (
        /* LINE App Chat Simulation Background */
        <div className="p-3 sm:p-5 bg-[#7b93a8] dark:bg-[#1a232c] flex flex-col items-center justify-center min-h-[360px] overflow-x-auto">
          {/* LINE Chat Timeline Stamp */}
          <div className="text-[10px] text-white/80 bg-black/20 px-2.5 py-0.5 rounded-full mb-3 select-none">
            วันนี้ {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{" "}
            น.
          </div>

          {/* LINE Message Container with Avatar */}
          <div className="flex min-w-0 items-start gap-2 max-w-full w-full justify-center">
            {/* Bot Avatar */}
            <div className="size-8 rounded-full bg-[#06C755] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-0.5">
              MM
            </div>

            {/* Bubble Card */}
            <div className="min-w-0 w-full max-w-[390px] flex-1 sm:max-w-[450px] rounded-2xl overflow-hidden shadow-lg bg-white text-zinc-900 border border-black/10">
              {/* Header Box */}
              {bubble?.header && (
                <div
                  className="p-4 text-white"
                  style={{
                    backgroundColor: bubble.header.backgroundColor || "#06c755",
                  }}
                >
                  {bubble.header.contents?.map((c, i) => (
                    <RenderFlexComponent key={i} component={c} defaultColor="#ffffff" />
                  ))}
                </div>
              )}

              {/* Body Box */}
              {bubble?.body && (
                <div className="p-4 space-y-2.5 bg-white text-zinc-900">
                  {bubble.body.contents?.map((c, i) => (
                    <RenderFlexComponent key={i} component={c} defaultColor="#1f2937" />
                  ))}
                </div>
              )}

              {/* Footer Box */}
              {bubble?.footer && (
                <div className="p-3.5 bg-zinc-50 border-t border-zinc-100 space-y-2">
                  {bubble.footer.contents?.map((c, i) => (
                    <RenderFlexComponent key={i} component={c} defaultColor="#374151" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Raw JSON Code View */
        <div className="p-4 bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto max-h-[480px]">
          <pre>{JSON.stringify(flexData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Recursive LINE Flex Component Renderer
 */
function RenderFlexComponent({
  component,
  defaultColor,
}: {
  component: FlexComponentSpec;
  defaultColor?: string | undefined;
}) {
  if (!component) return null;

  switch (component.type) {
    case "text": {
      const isBold = component.weight === "bold";
      const sizeClasses: Record<string, string> = {
        xxs: "text-[11px]",
        xs: "text-xs",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
        xl: "text-xl font-bold",
        xxl: "text-2xl font-bold",
        "3xl": "text-3xl font-bold",
        "4xl": "text-4xl font-bold",
        "5xl": "text-5xl font-bold",
      };
      const alignClasses: Record<string, string> = {
        start: "text-left",
        center: "text-center",
        end: "text-right",
      };

      const color = component.color || defaultColor || "inherit";

      return (
        <div
          className={`${sizeClasses[component.size || "md"] || "text-base"} ${
            alignClasses[component.align || "start"] || "text-left"
          } ${isBold ? "font-bold" : "font-normal"} ${component.wrap ? "break-words" : "truncate"} min-w-0`}
          style={{
            color,
            flex:
              component.flex !== undefined ? `${component.flex} ${component.flex} 0%` : undefined,
          }}
        >
          {component.text}
        </div>
      );
    }

    case "separator": {
      const marginMap: Record<string, string> = {
        xs: "my-1",
        sm: "my-1.5",
        md: "my-2",
        lg: "my-3",
        xl: "my-4",
      };
      return (
        <hr
          className={`border-t border-zinc-200 dark:border-zinc-300 ${marginMap[component.margin || "md"] || "my-2"}`}
        />
      );
    }

    case "box": {
      const isHorizontal = component.layout === "horizontal";
      const spacingMap: Record<string, string> = {
        none: "",
        xs: isHorizontal ? "gap-1" : "space-y-1",
        sm: isHorizontal ? "gap-2" : "space-y-1.5",
        md: isHorizontal ? "gap-3" : "space-y-2",
        lg: isHorizontal ? "gap-4" : "space-y-3",
        xl: isHorizontal ? "gap-5" : "space-y-4",
      };

      const marginMap: Record<string, string> = {
        none: "",
        xs: "mt-1",
        sm: "mt-1.5",
        md: "mt-2",
        lg: "mt-3",
        xl: "mt-4",
      };

      return (
        <div
          className={`w-full ${isHorizontal ? "flex items-center" : "flex flex-col"} ${
            spacingMap[component.spacing || "none"] || ""
          } ${marginMap[component.margin || "none"] || ""}`}
          style={{
            backgroundColor: component.backgroundColor || undefined,
            padding: component.paddingAll ? "12px" : undefined,
            flex:
              component.flex !== undefined ? `${component.flex} ${component.flex} 0%` : undefined,
            minWidth: 0,
          }}
        >
          {component.contents?.map((child, idx) => (
            <RenderFlexComponent key={idx} component={child} defaultColor={defaultColor} />
          ))}
        </div>
      );
    }

    case "button": {
      const isPrimary = component.style === "primary";
      const btnColor = component.color || (isPrimary ? "#06c755" : undefined);
      return (
        <button
          type="button"
          className={`w-full ${component.height === "sm" ? "py-2 text-xs" : "py-2.5 text-sm"} px-4 rounded-xl font-bold transition-all ${
            isPrimary ? "text-white shadow-xs" : "border border-zinc-200 bg-white text-zinc-800"
          }`}
          style={{ backgroundColor: btnColor }}
        >
          {component.action?.label || component.action?.text || "ปุ่มดำเนินการ"}
        </button>
      );
    }

    case "image": {
      return (
        <div className="w-full overflow-hidden rounded-xl my-1 flex items-center justify-center bg-zinc-100">
          <img
            src={component.url}
            alt="Flex Image"
            className="max-h-48 w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      );
    }

    default:
      return null;
  }
}
