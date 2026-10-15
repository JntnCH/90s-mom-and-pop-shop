/**
 * Server-side in-memory storage for LINE image messages.
 * Stores generated PNG slips and serves them via public HTTPS endpoint
 * so LINE's Messaging API and LIFF SDK can deliver real PNG images.
 */

export interface StoredLineImage {
  id: string;
  buffer: Buffer;
  contentType: string;
  createdAt: number;
}

// Global registry attached to globalThis to survive server module reloads
const globalStore = globalThis as unknown as {
  __MINIMARK_LINE_IMAGES?: Map<string, StoredLineImage>;
};

if (!globalStore.__MINIMARK_LINE_IMAGES) {
  globalStore.__MINIMARK_LINE_IMAGES = new Map<string, StoredLineImage>();
}

const imagesMap = globalStore.__MINIMARK_LINE_IMAGES;

/**
 * Stores a PNG or JPEG buffer and returns its identifier
 */
export function storeLineImage(id: string, buffer: Buffer, contentType = "image/png"): string {
  // Purge expired images if store exceeds 150 items
  if (imagesMap.size > 150) {
    const oldestAllowed = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    for (const [key, item] of imagesMap.entries()) {
      if (item.createdAt < oldestAllowed) {
        imagesMap.delete(key);
      }
    }
  }

  imagesMap.set(id, {
    id,
    buffer,
    contentType,
    createdAt: Date.now(),
  });

  return id;
}

/**
 * Retrieves a stored image by ID
 */
export function getLineImage(id: string): StoredLineImage | undefined {
  const cleanId = id.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  return imagesMap.get(cleanId);
}

/**
 * Stores base64 image data URL and returns the generated image ID
 */
export function storeLineImageFromBase64(base64Data: string, preferredId?: string): string {
  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  const contentType = matches?.[1] || "image/png";
  const rawBase64 = matches?.[2] || base64Data;
  const buffer = Buffer.from(rawBase64, "base64");

  const id = preferredId || `po_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return storeLineImage(id, buffer, contentType);
}
