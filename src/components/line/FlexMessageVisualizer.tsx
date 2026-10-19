import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Image as ImageIcon,
  Menu,
  MessageCircle,
  Search,
  Send,
  Share2,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { copyTextToClipboard, downloadJsonFile } from "@/lib/order-export";
import { copyImageBlobToClipboard, downloadImageBlob } from "@/lib/slip-image-generator";

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
    paddingAll?: string;
    contents?: FlexComponentSpec[];
  };
  footer?: {
    type: "box";
    layout: string;
    backgroundColor?: string;
    paddingAll?: string;
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
  title?: string | undefined;
  className?: string | undefined;
  onSendTest?: (() => void) | undefined;
  imageUrl?: string | undefined;
  imageBlob?: Blob | undefined;
  storeName?: string | undefined;
}

/**
 * Universal Visual Renderer for LINE Flex Message & Full-Bleed Rich Image
 * Replicates the authentic LINE Official Account mobile chat UI (Matching sample screenshot).
 */
export function FlexMessageVisualizer({
  flexData,
  title = "ตัวอย่าง LINE Flex & ภาพเต็มจอ",
  className = "",
  onSendTest,
  imageUrl,
  imageBlob,
  storeName = "โชห่วยยุค90s",
}: FlexMessageVisualizerProps) {
  const [copied, setCopied] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);
  const [viewMode, setViewMode] = useState<"visual" | "fullbleed" | "json">("visual");
  const [imageDisplayMode, setImageDisplayMode] = useState<"full" | "mockup">("full");

  const payload = flexData as FlexMessagePayload | null;
  const isCarousel =
    (payload?.contents as { type?: string })?.type === "carousel" ||
    (payload as { type?: string })?.type === "carousel";

  const rawContents = (payload?.contents as { contents?: unknown })?.contents ?? payload?.contents;
  const rawList = Array.isArray(rawContents)
    ? (rawContents as FlexBubbleSpec[])
    : Array.isArray((payload as { contents?: unknown })?.contents)
      ? (payload as { contents: FlexBubbleSpec[] }).contents
      : null;

  const bubbles: FlexBubbleSpec[] =
    rawList && rawList.length > 0
      ? rawList
      : [
          (payload?.contents as FlexBubbleSpec)?.type === "bubble"
            ? (payload?.contents as FlexBubbleSpec)
            : ((payload?.contents as { contents?: FlexBubbleSpec })?.contents as FlexBubbleSpec) ||
              (payload as unknown as FlexBubbleSpec),
        ].filter(Boolean);

  const [activeBubbleIndex, setActiveBubbleIndex] = useState(0);
  const [carouselViewStyle, setCarouselViewStyle] = useState<"strip" | "single">("strip");

  const altText =
    payload?.altText ||
    (isCarousel ? "LINE Flex Carousel (หลายการ์ด)" : "LINE Flex Message / Rich Banner");

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

  const handleCopyImage = async () => {
    if (!imageBlob) {
      toast.info("ยังไม่มีข้อมูลรูปภาพพร้อมคัดลอก");
      return;
    }
    const ok = await copyImageBlobToClipboard(imageBlob);
    if (ok) {
      setCopiedImg(true);
      toast.success("คัดลอกภาพ PNG เต็มจอลงคลิปบอร์ดแล้ว วางในแชท LINE ได้ทันที");
      setTimeout(() => setCopiedImg(false), 2000);
    } else {
      toast.error("เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพอัตโนมัติ");
    }
  };

  const handleDownloadImage = () => {
    if (!imageBlob) return;
    const fname = `LINE_FullBleed_${new Date().toISOString().slice(0, 10)}.png`;
    downloadImageBlob(imageBlob, fname);
    toast.success("ดาวน์โหลดรูปภาพ PNG เต็มจอ (1040px) เรียบร้อย");
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
              {imageUrl && (
                <TabsTrigger value="fullbleed" className="h-7 text-xs px-2.5 rounded-md gap-1">
                  <ImageIcon className="size-3 text-orange-500" /> เต็มจอแบบตัวอย่าง
                </TabsTrigger>
              )}
              <TabsTrigger value="visual" className="h-7 text-xs px-2.5 rounded-md gap-1">
                <Smartphone className="size-3" /> บับเบิ้ล Flex
              </TabsTrigger>
              <TabsTrigger value="json" className="h-7 text-xs px-2.5 rounded-md gap-1">
                <Code2 className="size-3" /> JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {imageUrl && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs rounded-lg gap-1 font-semibold text-orange-600 dark:text-orange-400 border-orange-500/40 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                onClick={handleCopyImage}
                title="คัดลอกภาพ PNG เต็มจอ"
              >
                {copiedImg ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span className="hidden sm:inline">คัดลอกภาพ</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs rounded-lg gap-1 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={handleDownloadImage}
                title="ดาวน์โหลดภาพ PNG (1040px)"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">PNG 1040px</span>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs rounded-lg gap-1 font-semibold text-zinc-700 dark:text-zinc-300"
            onClick={handleDownloadJson}
            title="ดาวน์โหลดไฟล์ .json"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">JSON</span>
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
      {viewMode === "fullbleed" && imageUrl ? (
        <div className="p-3 sm:p-5 bg-gradient-to-b from-[#e5ddd5] to-[#d6c7b2] dark:from-[#1b242e] dark:to-[#111822] flex flex-col items-center justify-center min-h-[460px] overflow-x-auto">
          {/* Display Mode Toggle */}
          <div className="flex items-center gap-1.5 mb-3.5 bg-black/30 backdrop-blur-xs p-1 rounded-xl text-white">
            <button
              type="button"
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                imageDisplayMode === "full"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-white/80 hover:text-white"
              }`}
              onClick={() => setImageDisplayMode("full")}
            >
              🖼️ ภาพเต็มจอ (Full Size 1040px)
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                imageDisplayMode === "mockup"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-white/80 hover:text-white"
              }`}
              onClick={() => setImageDisplayMode("mockup")}
            >
              📱 จำลองจอแชท LINE
            </button>
          </div>

          {imageDisplayMode === "full" ? (
            /* True Edge-to-Edge Full Screen Poster View (Razor sharp, large fonts) */
            <div className="w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-black/15 bg-white group relative">
              <img
                src={imageUrl}
                alt="Full-Bleed 1040px Poster"
                className="w-full h-auto object-contain block"
              />
            </div>
          ) : (
            /* Simulated Mobile Device Window Frame */
            <div className="w-full max-w-[480px] rounded-3xl overflow-hidden shadow-2xl border border-black/20 bg-[#f7f5f2] dark:bg-[#1f2937] flex flex-col">
              {/* 1. Mobile Status Bar & LINE OA Header */}
              <div className="bg-[#f0ebe3] dark:bg-[#1a232d] px-3.5 py-2.5 border-b border-black/10 flex items-center justify-between text-zinc-900 dark:text-zinc-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ChevronLeft className="size-5 shrink-0 text-zinc-700 dark:text-zinc-300" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">99+</span>
                  <div className="ml-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <div className="size-3.5 rounded-full bg-[#06C755] flex items-center justify-center text-white text-[9px] font-bold">
                        ✓
                      </div>
                      <span className="text-xs font-bold truncate">{storeName}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-none">
                      ตอบกลับอัตโนมัติ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                  <Search className="size-4 cursor-pointer" />
                  <Menu className="size-4 cursor-pointer" />
                </div>
              </div>

              {/* 2. Chat Timeline Stamp */}
              <div className="py-2.5 flex justify-center">
                <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 bg-black/10 dark:bg-white/10 px-3 py-0.5 rounded-full select-none">
                  อ. 29/9
                </div>
              </div>

              {/* 3. Full-Bleed Edge-to-Edge Image Message Container */}
              <div className="px-2 py-1 flex flex-col items-center">
                <div className="w-full rounded-2xl overflow-hidden shadow-md border border-black/10 bg-white">
                  <img
                    src={imageUrl}
                    alt="Full-Bleed LINE Rich Banner"
                    className="w-full h-auto object-cover block"
                  />
                </div>

                {/* Timestamp on right */}
                <div className="w-full text-right pr-2 pt-1">
                  <span className="text-[10px] text-zinc-500 font-medium">19:00</span>
                </div>
              </div>

              {/* 4. Bottom Simulated LINE Chat Bar */}
              <div className="mt-2 bg-[#f0ebe3] dark:bg-[#1a232d] px-3 py-2 border-t border-black/10 flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs">
                    ⌨️
                  </div>
                  <div className="text-xs text-zinc-400">พิมพ์ข้อความ...</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 px-2 py-1 bg-zinc-200/60 dark:bg-zinc-700/60 rounded-md">
                  <span>เมนู</span>
                  <span className="text-[9px]">▲</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "visual" ? (
        /* LINE App Chat Simulation Background (Flex Bubble & Carousel) */
        <div className="p-3 sm:p-5 bg-[#7b93a8] dark:bg-[#1a232c] flex flex-col items-center justify-center min-h-[360px] overflow-x-auto">
          {/* LINE Chat Timeline Stamp & Format Tag */}
          <div className="flex items-center gap-2 mb-3 select-none flex-wrap justify-center">
            <span className="text-[10px] text-white/80 bg-black/20 px-2.5 py-0.5 rounded-full">
              วันนี้{" "}
              {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
            </span>
            {isCarousel ? (
              <span className="text-[11px] text-white font-bold bg-emerald-600/95 px-3 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                🎠 รูปแบบที่ 1: Carousel ({bubbles.length} การ์ด • 20 รายการ/การ์ด
                เรียงเลขต่อเนื่อง)
              </span>
            ) : (
              <span className="text-[11px] text-white font-bold bg-blue-600/95 px-3 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                💬 รูปแบบที่ 2: Bubble (การ์ดเดี่ยวยาว รวมทุกรายการ)
              </span>
            )}
          </div>

          {/* Carousel Step Controls if multiple bubbles */}
          {isCarousel && bubbles.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3 bg-black/30 backdrop-blur-xs px-3 py-1.5 rounded-xl text-white">
              <div className="flex items-center gap-1 bg-black/25 p-0.5 rounded-lg">
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    carouselViewStyle === "strip"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "text-white/75 hover:text-white"
                  }`}
                  onClick={() => setCarouselViewStyle("strip")}
                >
                  🎠 เรียงหลายการ์ด ({bubbles.length} ใบ)
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    carouselViewStyle === "single"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "text-white/75 hover:text-white"
                  }`}
                  onClick={() => setCarouselViewStyle("single")}
                >
                  📱 ดูทีละการ์ด
                </button>
              </div>

              {carouselViewStyle === "single" && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-white hover:bg-white/20 rounded-lg"
                    disabled={activeBubbleIndex <= 0}
                    onClick={() => setActiveBubbleIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs font-semibold">
                    การ์ด {activeBubbleIndex + 1} / {bubbles.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-white hover:bg-white/20 rounded-lg"
                    disabled={activeBubbleIndex >= bubbles.length - 1}
                    onClick={() =>
                      setActiveBubbleIndex((prev) => Math.min(bubbles.length - 1, prev + 1))
                    }
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-1">
                {bubbles.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      idx === activeBubbleIndex && carouselViewStyle === "single"
                        ? "bg-white text-zinc-900"
                        : "bg-white/20 text-white hover:bg-white/35"
                    }`}
                    onClick={() => {
                      setActiveBubbleIndex(idx);
                      setCarouselViewStyle("single");
                    }}
                    title={`เปิดดูการ์ดที่ ${idx + 1}`}
                  >
                    ใบที่ {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LINE Message Container with Avatar */}
          {isCarousel && bubbles.length > 1 && carouselViewStyle === "strip" ? (
            <div className="w-full max-w-full overflow-x-auto pb-2 pt-1 px-1">
              <div className="flex items-start gap-3 min-w-max mx-auto">
                {/* Bot Avatar */}
                <div className="size-8 rounded-full bg-[#06C755] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-0.5">
                  MM
                </div>
                {bubbles.map((b, idx) => (
                  <div key={idx} className="w-[340px] sm:w-[370px] shrink-0 flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold text-white bg-black/30 px-2.5 py-1 rounded-lg text-center">
                      🎠 การ์ดใบที่ {idx + 1} / {bubbles.length}
                    </div>
                    <RenderSingleBubble bubble={b} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-2 max-w-full w-full justify-center">
              {/* Bot Avatar */}
              <div className="size-8 rounded-full bg-[#06C755] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-0.5">
                MM
              </div>

              {/* Bubble Card Rendering */}
              <div className="min-w-0 w-full max-w-[390px] flex-1 sm:max-w-[450px]">
                <RenderSingleBubble bubble={bubbles[activeBubbleIndex] || bubbles[0]} />
              </div>
            </div>
          )}
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
 * Bubble Card Renderer for Single Bubble or Carousel Card
 */
function RenderSingleBubble({ bubble }: { bubble: FlexBubbleSpec | undefined }) {
  if (!bubble) return null;
  return (
    <div className="min-w-0 w-full max-w-[440px] flex-1 sm:max-w-[500px] rounded-2xl overflow-hidden shadow-lg bg-white text-zinc-900 border border-black/10 flex flex-col">
      {/* Header Box */}
      {bubble.header && (
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
      {bubble.body && (
        <div className="p-4 space-y-2.5 bg-white text-zinc-900 flex-1">
          {bubble.body.contents?.map((c, i) => (
            <RenderFlexComponent key={i} component={c} defaultColor="#1f2937" />
          ))}
        </div>
      )}

      {/* Footer Box */}
      {bubble.footer && (
        <div
          className="p-3.5 space-y-2 border-t mt-auto"
          style={{
            backgroundColor: bubble.footer.backgroundColor || "#fafafa",
          }}
        >
          {bubble.footer.contents?.map((c, i) => (
            <RenderFlexComponent key={i} component={c} defaultColor="#ffffff" />
          ))}
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
        xxs: "text-xs font-medium",
        xs: "text-xs sm:text-sm font-medium",
        sm: "text-sm sm:text-base",
        md: "text-base sm:text-lg font-medium",
        lg: "text-lg sm:text-xl font-bold",
        xl: "text-xl sm:text-2xl font-bold",
        xxl: "text-2xl sm:text-3xl font-extrabold",
        "3xl": "text-3xl sm:text-4xl font-extrabold",
        "4xl": "text-4xl sm:text-5xl font-extrabold",
        "5xl": "text-5xl sm:text-6xl font-extrabold",
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
