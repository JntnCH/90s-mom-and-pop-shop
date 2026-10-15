/**
 * Image processing utilities for product photos and camera capture.
 * Automatically resizes & compresses images to lightweight base64 Data URLs.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "image/jpeg" | "image/webp" | "image/png";
}

/**
 * Resizes and compresses a File or Blob into a compact base64 data URL.
 */
export async function compressImageFile(
  file: File | Blob,
  options: CompressImageOptions = {},
): Promise<string> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.82, format = "image/jpeg" } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("รูปภาพไม่ถูกต้องหรือเสียหาย"));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Clean white background for transparent PNG converted to JPEG
        if (format === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(format, quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Captures a single frame snapshot from an active HTMLVideoElement.
 */
export function captureFrameFromVideo(
  video: HTMLVideoElement,
  options: CompressImageOptions = {},
): string | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const { maxWidth = 800, maxHeight = 800, quality = 0.85, format = "image/jpeg" } = options;

  let width = video.videoWidth;
  let height = video.videoHeight;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL(format, quality);
}
