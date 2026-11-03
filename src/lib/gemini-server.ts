import { GoogleGenAI } from "@google/genai";

export interface ExtractedReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  total: number;
  suggestedBarcode?: string;
}

export interface ExtractedReceiptData {
  docType: "PURCHASE_GOODS" | "GENERAL_EXPENSE";
  docTypeReason?: string;
  docNumber: string;
  docDate: string; // YYYY-MM-DD
  merchantName: string;
  merchantTaxId?: string;
  merchantBranch?: string;
  merchantAddress?: string;
  merchantPhone?: string;
  expenseCategory: string;
  items: ExtractedReceiptItem[];
  subtotal: number;
  discountTotal: number;
  vatAmount: number;
  grandTotal: number;
  paymentMethod?: string;
  rawNotes?: string;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Extracts structured receipt/invoice information using Gemini 3.8 Flash Vision.
 * Handles Thai and English receipts, tax invoices, purchase bills, and general utility expenses.
 */
export async function extractReceiptWithGemini(
  base64Data: string,
  mimeType: string = "image/jpeg",
): Promise<ExtractedReceiptData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.",
    );
  }

  const ai = getAiClient();

  // Clean base64 string if it contains data URI header
  let cleanBase64 = base64Data;
  let detectedMime = mimeType;

  if (base64Data.includes(";base64,")) {
    const parts = base64Data.split(";base64,");
    const mimeMatch = parts[0]?.match(/data:([^;]+)/);
    if (mimeMatch && mimeMatch[1]) {
      detectedMime = mimeMatch[1];
    }
    cleanBase64 = parts[1] || "";
  }

  // Ensure standard MIME types
  if (!detectedMime || detectedMime === "application/octet-stream") {
    detectedMime = "image/jpeg";
  }

  const systemInstruction = `You are an expert bilingual (Thai and English) Document OCR & Financial Receipt Extraction Specialist for a retail grocery and general store ("โชห่วยยุค90s").

Your task is to analyze document images (receipts, tax invoices, purchase orders, delivery notes, utility bills like MEA/PEA electricity, MWA/PWA water, phone/internet bills, rental receipts) and extract structured JSON data.

CRITICAL INSTRUCTION - CLASSIFY DOCUMENT TYPE:
1. "PURCHASE_GOODS" (บิลซื้อสินค้าเข้าร้าน):
   - The receipt is for purchasing commercial goods/inventory/stock intended to be resold or stocked in the retail store.
   - Examples: wholesale market receipts (Makro, Big C, Lotus, CJ, wholesaler, supplier), snacks, drinks, canned goods, household merchandise, groceries.
   - This type WILL be linked to the inventory system to increase product stock.

2. "GENERAL_EXPENSE" (บิลค่าใช้จ่ายทั่วไป):
   - The receipt is for operational, facility, utility, or overhead expenses of the shop that DO NOT go into product resale inventory.
   - Examples: electricity bill (บิลค่าไฟฟ้า การไฟฟ้านครหลวง/ภูมิภาค), water bill (ค่าน้ำประปา), internet/telephone bill (ค่าอินเทอร์เน็ต/โทรศัพท์ True/AIS/3BB/NT), rent receipt (ค่าเช่าร้าน/อาคาร), maintenance/repairs (ค่าซ่อมแซมแอร์/ตู้แช่), packaging/consumables (ถุงพลาสติก/กระดาษความร้อน), staff wages/labour (ค่าจ้าง/แรงงาน), government fees/licenses.
   - This type WILL NOT increase product inventory stock.

FIELDS TO EXTRACT:
- docType: "PURCHASE_GOODS" or "GENERAL_EXPENSE"
- docTypeReason: Brief Thai explanation why it is classified as this type (e.g. "บิลค่าไฟฟ้าการไฟฟ้านครหลวง เป็นค่าสาธารณูปโภคประจำเดือน" or "บิลซื้อสินค้าเครื่องดื่มและขนมจากแม็คโครสำหรับขายหน้าร้าน")
- docNumber: Invoice/Receipt number (e.g., TAX-2026-001, POS-12938, INV12345). If none found, generate an empty string or standard identifier.
- docDate: Date in ISO format (YYYY-MM-DD). If Buddhist Era (พ.ศ.) like 2569 or 2567, convert to Gregorian (C.E.) year (subtract 543). Today is around 2026.
- merchantName: Name of the vendor, store, or utility issuer (e.g. "สยามแม็คโคร", "การไฟฟ้านครหลวง", "บจก. ซีพี ออลล์")
- merchantTaxId: 13-digit Thai tax identification number if found.
- merchantBranch: Branch name or code (e.g. "สำนักงานใหญ่", "สาขาสวนหลวง")
- merchantAddress: Address if available.
- merchantPhone: Phone number if available.
- expenseCategory: One of:
  * "ซื้อสินค้าเข้าร้าน" (for PURCHASE_GOODS)
  * "ค่าไฟฟ้า"
  * "ค่าน้ำประปา"
  * "ค่าเช่าสถานที่"
  * "ค่าอินเทอร์เน็ตและโทรศัพท์"
  * "วัสดุสิ้นเปลืองและบรรจุภัณฑ์"
  * "ค่าขนส่งและโลจิสติกส์"
  * "ค่าซ่อมแซมและบำรุงรักษา"
  * "ค่าจ้างและแรงงาน"
  * "ค่าธรรมเนียมและภาษี"
  * "ค่าใช้จ่ายทั่วไปอื่นๆ"
- items: Array of line items:
  * name: Full item name (e.g. "โค้ก รสออริจินัล 325 มล. แพ็ค 24 กระป๋อง", "ค่าบริการไฟฟ้าประจำเดือน 09/2569")
  * quantity: Numeric quantity (default 1)
  * unit: Unit string (e.g. "ชิ้น", "แพ็ค", "ลัง", "ขวด", "กระป๋อง", "กล่อง", "กิโลกรัม", "หน่วย", "เดือน", "งาน")
  * unitPrice: Price per unit in THB (numeric)
  * discount: Line discount in THB (numeric, default 0)
  * total: Line total in THB (numeric)
  * suggestedBarcode: Any product barcode/SKU number printed next to the item, or empty string.
- subtotal: Subtotal before tax and discount in THB.
- discountTotal: Total overall bill discount in THB.
- vatAmount: VAT amount (e.g. 7% VAT) in THB.
- grandTotal: Net total amount to pay in THB.
- paymentMethod: CASH, BANK_TRANSFER, CREDIT_CARD, PROMPTPAY, or OTHER.
- rawNotes: Any additional remarks, invoice footer messages, or warranty details.

Output valid JSON only. Do not wrap in markdown or backticks.`;

  const promptText =
    "Extract all receipt and expense information from this document image/PDF following the specified schema and classifications.";

  const imagePart = {
    inlineData: {
      mimeType: detectedMime,
      data: cleanBase64,
    },
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: {
      parts: [imagePart, { text: promptText }],
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  const rawJson = (response.text || "").trim();
  if (!rawJson) {
    throw new Error("No data returned from Gemini OCR model.");
  }

  // Parse JSON with fallback cleanup
  try {
    const parsed = JSON.parse(rawJson);
    return normalizeReceiptData(parsed);
  } catch (parseErr) {
    // Attempt markdown block stripping if needed
    const cleaned = rawJson
      .replace(/```(?:json)?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return normalizeReceiptData(parsed);
  }
}

function normalizeReceiptData(data: Record<string, unknown>): ExtractedReceiptData {
  const isPurchase = data.docType === "PURCHASE_GOODS";
  const docType: "PURCHASE_GOODS" | "GENERAL_EXPENSE" = isPurchase
    ? "PURCHASE_GOODS"
    : "GENERAL_EXPENSE";

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: ExtractedReceiptItem[] = rawItems.map((it: Record<string, unknown>) => {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const unitPrice = Number(it.unitPrice) || 0;
    const discount = Number(it.discount) || 0;
    const total = Number(it.total) || Math.max(0, qty * unitPrice - discount);

    return {
      name: String(it.name || "รายการสินค้า/บริการ").trim(),
      quantity: qty,
      unit: String(it.unit || (isPurchase ? "ชิ้น" : "รายการ")).trim(),
      unitPrice,
      discount,
      total,
      suggestedBarcode: it.suggestedBarcode ? String(it.suggestedBarcode).trim() : undefined,
    };
  });

  const grandTotal = Number(data.grandTotal) || items.reduce((sum, it) => sum + (it.total || 0), 0);
  const subtotal =
    Number(data.subtotal) || items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const discountTotal = Number(data.discountTotal) || 0;
  const vatAmount = Number(data.vatAmount) || 0;

  let docDate = String(data.docDate || "").trim();
  if (!docDate || !docDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    docDate = new Date().toISOString().slice(0, 10);
  }

  return {
    docType,
    docTypeReason: data.docTypeReason ? String(data.docTypeReason) : undefined,
    docNumber: String(data.docNumber || `REC-${Date.now().toString().slice(-6)}`).trim(),
    docDate,
    merchantName: String(data.merchantName || "ไม่ระบุชื่อร้านค้า").trim(),
    merchantTaxId: data.merchantTaxId ? String(data.merchantTaxId).trim() : undefined,
    merchantBranch: data.merchantBranch ? String(data.merchantBranch).trim() : undefined,
    merchantAddress: data.merchantAddress ? String(data.merchantAddress).trim() : undefined,
    merchantPhone: data.merchantPhone ? String(data.merchantPhone).trim() : undefined,
    expenseCategory: String(
      data.expenseCategory || (isPurchase ? "ซื้อสินค้าเข้าร้าน" : "ค่าใช้จ่ายทั่วไป"),
    ).trim(),
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    paymentMethod: String(data.paymentMethod || "CASH"),
    rawNotes: data.rawNotes ? String(data.rawNotes) : undefined,
  };
}
