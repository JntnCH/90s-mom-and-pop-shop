import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import * as ZXing from "@zxing/library";
const zxingPkg = (ZXing as unknown as { default?: typeof ZXing }).default || ZXing;
const { BarcodeFormat, DecodeHintType } = zxingPkg;
import { useCallback, useEffect, useRef, useState } from "react";

import { playScanSuccessSound } from "@/lib/scanner-audio";
import { classifyScanType, ScannerDeduplicator, type CodeType } from "@/lib/scanner-dedup";

export type ScannerStatus = "idle" | "starting" | "scanning" | "error";

export interface ScannerDiagnostics {
  readerEngine: string;
  hasCameraSupport: boolean;
  activeDeviceId?: string;
  lastScannedCode?: string;
  lastScannedFormat?: string;
  lastScannedType?: CodeType;
  lastScannedAt?: string;
  errorDetail?: string;
  isNativeAccelerated?: boolean;
}

export type ScanCallback = (code: string, format?: string, type?: CodeType) => void;

export interface UseBarcodeScannerOptions {
  cooldownMs?: number;
  playSound?: boolean;
  autoStart?: boolean;
  facingMode?: "environment" | "user";
  scanIntervalMs?: number;
}

// Check native BarcodeDetector support
interface NativeBarcodeDetectorResult {
  rawValue: string;
  format: string;
}

interface NativeBarcodeDetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<NativeBarcodeDetectorResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): NativeBarcodeDetectorInstance;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

/**
 * Ultra-Fast Barcode & QR Scanner hook
 * Uses Hardware-Accelerated Native BarcodeDetector API when available (< 5ms detection)
 * with instant fallback to ZXing Turbo MultiFormat Reader with optimized hints.
 */
export function useBarcodeScanner(
  onDetected: ScanCallback,
  options: UseBarcodeScannerOptions = {},
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const isScanningActiveRef = useRef<boolean>(false);

  const playSoundRef = useRef<boolean>(options.playSound ?? true);
  playSoundRef.current = options.playSound ?? true;

  const dedupRef = useRef<ScannerDeduplicator>(
    new ScannerDeduplicator({ cooldownMs: options.cooldownMs ?? 1000 }),
  );
  const onDetectedRef = useRef<ScanCallback>(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics>({
    readerEngine: "Detecting...",
    hasCameraSupport: true,
  });

  useEffect(() => {
    const hasMedia =
      typeof navigator !== "undefined" && Boolean(navigator?.mediaDevices?.getUserMedia);
    setSupported(hasMedia);
    setDiagnostics((prev) => ({
      ...prev,
      hasCameraSupport: hasMedia,
    }));
  }, []);

  const handleScanSuccess = useCallback((rawCode: string, rawFormat?: string) => {
    const raw = rawCode.trim();
    if (!raw) return;

    const formatStr = rawFormat ? String(rawFormat) : "BARCODE";
    const type = classifyScanType(formatStr, raw);

    const accepted = dedupRef.current.shouldAccept(raw, formatStr);
    if (accepted) {
      const nowStr = new Date().toLocaleTimeString("th-TH");

      if (playSoundRef.current) {
        playScanSuccessSound();
      }

      setDiagnostics((prev) => ({
        ...prev,
        lastScannedCode: raw,
        lastScannedFormat: formatStr,
        lastScannedType: type,
        lastScannedAt: nowStr,
      }));
      onDetectedRef.current(raw, formatStr, type);
    }
  }, []);

  const stop = useCallback(() => {
    isScanningActiveRef.current = false;
    if (loopTimerRef.current !== null) {
      window.cancelAnimationFrame(loopTimerRef.current);
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }

    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Safe ignore
      }
      controlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsTorchOn(false);
    setHasTorch(false);
    setStatus("idle");
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const capabilities = track.getCapabilities
        ? (track.getCapabilities() as { torch?: boolean })
        : {};
      if (capabilities.torch) {
        const nextTorch = !isTorchOn;
        // @ts-expect-error torch constraint
        await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
        setIsTorchOn(nextTorch);
      }
    } catch {
      // Ignore torch error
    }
  }, [isTorchOn]);

  const start = useCallback(
    async (providedVideoEl?: HTMLVideoElement | null) => {
      if (typeof navigator === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setSupported(false);
        setError("เบราว์เซอร์นี้ไม่รองรับการเข้าถึงกล้อง กรุณากรอกรหัสด้วยมือ");
        setStatus("error");
        return;
      }

      stop();
      setError(null);
      setPermissionDenied(false);
      setStatus("starting");
      isScanningActiveRef.current = true;

      try {
        // Wait up to 500ms for video element to mount
        let video = providedVideoEl || videoRef.current;
        if (!video) {
          for (let i = 0; i < 8; i++) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            video = providedVideoEl || videoRef.current;
            if (video) break;
          }
        }

        if (!video) {
          throw new Error("Video element is not mounted");
        }

        // Camera constraints optimized for barcode scanning & fast autofocus
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: options.facingMode || "environment" },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 60, min: 24 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();

        // Check torch capabilities
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities) {
          const caps = videoTrack.getCapabilities() as { torch?: boolean };
          setHasTorch(Boolean(caps.torch));
        }

        // Strategy 1: Native BarcodeDetector (Hardware Accelerated, < 5ms per frame)
        const hasNativeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

        if (hasNativeDetector && window.BarcodeDetector) {
          try {
            const formats = [
              "ean_13",
              "ean_8",
              "code_128",
              "code_39",
              "qr_code",
              "upc_a",
              "upc_e",
              "itf",
              "data_matrix",
            ];
            const nativeDetector = new window.BarcodeDetector({ formats });

            setDiagnostics((prev) => ({
              ...prev,
              readerEngine: "Native Hardware Acceleration (BarcodeDetector Web API)",
              isNativeAccelerated: true,
            }));
            setStatus("scanning");

            const scanNativeLoop = async () => {
              if (!isScanningActiveRef.current || !video || video.readyState < 2) {
                if (isScanningActiveRef.current) {
                  loopTimerRef.current = window.requestAnimationFrame(scanNativeLoop);
                }
                return;
              }

              try {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                  const first = barcodes[0];
                  if (first && first.rawValue) {
                    handleScanSuccess(first.rawValue, first.format);
                  }
                }
              } catch {
                // Ignore transient frame decode drops
              }

              if (isScanningActiveRef.current) {
                // Throttle slightly to keep UI fluid (around 30-40 fps)
                loopTimerRef.current = window.setTimeout(scanNativeLoop, 30);
              }
            };

            loopTimerRef.current = window.requestAnimationFrame(scanNativeLoop);
            return;
          } catch (nativeInitErr) {
            console.warn(
              "Native BarcodeDetector failed, falling back to ZXing Turbo",
              nativeInitErr,
            );
          }
        }

        // Strategy 2: ZXing Turbo Reader with Preconfigured Fast Hints
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.ITF,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, false); // Disabled try_harder gives 4x speedup

        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: options.scanIntervalMs ?? 35,
          });
        }

        setDiagnostics((prev) => ({
          ...prev,
          readerEngine: "@zxing/browser Turbo Engine (MultiFormat)",
          isNativeAccelerated: false,
        }));

        const controls = await readerRef.current.decodeFromStream(
          stream,
          video,
          (result, decodeErr) => {
            if (result) {
              const raw = result.getText();
              const formatNumber = result.getBarcodeFormat();
              handleScanSuccess(raw, String(formatNumber));
            }
            if (decodeErr && decodeErr.name !== "NotFoundException") {
              // Frame dropped, proceed
            }
          },
        );

        controlsRef.current = controls;
        setStatus("scanning");
      } catch (err: unknown) {
        const errName = (err as { name?: string })?.name ?? "";
        const errMsg = (err as { message?: string })?.message ?? "";

        let userMsg = "เปิดกล้องไม่สำเร็จ กรุณาตรวจสอบการอนุญาตใช้งานกล้องบนเบราว์เซอร์";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          userMsg =
            "ไม่ได้รับอนุญาตให้ใช้กล้อง (Permission Denied) กรุณาอนุญาตสิทธิ์ในเบราว์เซอร์ หรือกรอกรหัสด้วยมือ";
          setPermissionDenied(true);
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          userMsg = "ไม่พบอุปกรณ์กล้องบนเครื่องนี้ กรุณากรอกรหัสด้วยมือ";
        }

        setError(userMsg);
        setDiagnostics((prev) => ({
          ...prev,
          errorDetail: `${errName}: ${errMsg}`,
        }));
        setStatus("error");
        stop();
      }
    },
    [stop, options.facingMode, options.scanIntervalMs, handleScanSuccess],
  );

  useEffect(() => {
    if (options.autoStart) {
      void start();
    }
    return () => {
      stop();
    };
  }, [options.autoStart, start, stop]);

  const resetDeduplication = useCallback(() => {
    dedupRef.current.resetAll();
  }, []);

  return {
    videoRef,
    status,
    error,
    permissionDenied,
    supported,
    diagnostics,
    hasTorch,
    isTorchOn,
    toggleTorch,
    start,
    stop,
    resetDeduplication,
  };
}
