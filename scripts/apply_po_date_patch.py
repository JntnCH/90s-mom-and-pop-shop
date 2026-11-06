#!/usr/bin/env python3
"""Patch PO Thai date format + newest-first list sort."""
from pathlib import Path
import re
import sys

def patch_store():
    path = Path("src/lib/store.ts")
    text = path.read_text()

    helper = """
/** Format date/time as Thai locale string e.g. 6/11/2569 10:15:30 */
export function formatThaiDateTime(date: Date = new Date()): string {
  return (
    date.toLocaleDateString("th-TH") +
    " " +
    date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  );
}

"""

    if "formatThaiDateTime" not in text:
        if "export function generateNextOrderNumber" not in text:
            print("FAIL: generateNextOrderNumber not found", file=sys.stderr)
            sys.exit(1)
        text = text.replace(
            "export function generateNextOrderNumber",
            helper + "export function generateNextOrderNumber",
            1,
        )
        print("added formatThaiDateTime")

    old_add = """  addPurchaseOrder(item: Omit<PurchaseOrderRecord, "id">) {
    const list = this.getPurchaseOrders();
    const nowIso = new Date().toISOString();
    const newItem: PurchaseOrderRecord = {
      ...item,
      id: `po-${Date.now()}`,
      createdAt: item.createdAt || nowIso,
      updatedAt: item.updatedAt || nowIso,
    };"""
    new_add = """  addPurchaseOrder(item: Omit<PurchaseOrderRecord, "id">) {
    const list = this.getPurchaseOrders();
    const nowThai = formatThaiDateTime();
    const newItem: PurchaseOrderRecord = {
      ...item,
      id: `po-${Date.now()}`,
      createdAt: item.createdAt || nowThai,
      updatedAt: item.updatedAt || nowThai,
    };"""
    if old_add not in text:
        print("FAIL: addPurchaseOrder block not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_add, new_add, 1)
    print("patched addPurchaseOrder")

    old_save = """  savePurchaseOrder(
    record: (Omit<PurchaseOrderRecord, "id"> & { id?: string }) | PurchaseOrderRecord,
  ): PurchaseOrderRecord {
    const list = this.getPurchaseOrders();
    const nowIso = new Date().toISOString();
    if (record.id) {
      const idx = list.findIndex((po) => po.id === record.id);
      if (idx >= 0) {
        const updated: PurchaseOrderRecord = {
          ...list[idx],
          ...record,
          updatedAt: nowIso,
        } as PurchaseOrderRecord;"""
    new_save = """  savePurchaseOrder(
    record: (Omit<PurchaseOrderRecord, "id"> & { id?: string }) | PurchaseOrderRecord,
  ): PurchaseOrderRecord {
    const list = this.getPurchaseOrders();
    const nowThai = formatThaiDateTime();
    if (record.id) {
      const idx = list.findIndex((po) => po.id === record.id);
      if (idx >= 0) {
        const updated: PurchaseOrderRecord = {
          ...list[idx],
          ...record,
          updatedAt: nowThai,
        } as PurchaseOrderRecord;"""
    if old_save not in text:
        print("FAIL: savePurchaseOrder start not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_save, new_save, 1)
    print("patched savePurchaseOrder start")

    old_newpo = "createdAt: record.createdAt || nowIso,\n      updatedAt: nowIso,"
    new_newpo = "createdAt: record.createdAt || nowThai,\n      updatedAt: nowThai,"
    if old_newpo not in text:
        print("FAIL: newPO dates not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_newpo, new_newpo, 1)
    print("patched newPO dates")

    text2 = text.replace(
        "updatedAt: new Date().toISOString(),\n    };\n    const remaining = list.filter((po) => po.id !== id);\n    this.savePurchaseOrders([updated, ...remaining]);\n    return updated;\n  },\n  updatePurchaseOrderStatus(",
        "updatedAt: formatThaiDateTime(),\n    };\n    const remaining = list.filter((po) => po.id !== id);\n    this.savePurchaseOrders([updated, ...remaining]);\n    return updated;\n  },\n  updatePurchaseOrderStatus(",
        1,
    )
    if text2 != text:
        print("patched updatePurchaseOrder")
        text = text2

    text2 = text.replace(
        "po.id === id ? { ...po, status, updatedAt: new Date().toISOString() } : po,",
        "po.id === id ? { ...po, status, updatedAt: formatThaiDateTime() } : po,",
        1,
    )
    if text2 != text:
        print("patched updatePurchaseOrderStatus")
        text = text2

    path.write_text(text)
    assert "formatThaiDateTime" in text
    assert "nowThai" in text
    print("store.ts OK")


def patch_reorder():
    path = Path("src/routes/reorder.tsx")
    text = path.read_text()

    m = re.search(r'import\s*\{([^}]+)\}\s*from\s*"@/lib/store";', text, re.DOTALL)
    if not m:
        print("FAIL: store import not found", file=sys.stderr)
        sys.exit(1)
    names = m.group(1)
    to_add = []
    if "formatThaiDateTime" not in names:
        to_add.append("formatThaiDateTime")
    if "sortPurchaseOrdersNewestFirst" not in names:
        to_add.append("sortPurchaseOrdersNewestFirst")
    if to_add:
        new_names = names.rstrip() + ",\n  " + ",\n  ".join(to_add)
        text = text[: m.start(1)] + new_names + text[m.end(1) :]
        print("imports added", to_add)

    old_filt = """  const filteredPOs = purchaseOrders.filter((po) => {
    if (poStatusFilter !== "ALL" && po.status !== poStatusFilter) return false;
    const q = poSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      po.orderNumber.toLowerCase().includes(q) ||
      (po.supplierName && po.supplierName.toLowerCase().includes(q)) ||
      po.items.some(
        (it) => it.productName.toLowerCase().includes(q) || it.barcode.toLowerCase().includes(q),
      )
    );
  });"""

    new_filt = """  const filteredPOs = sortPurchaseOrdersNewestFirst(
    purchaseOrders.filter((po) => {
      if (poStatusFilter !== "ALL" && po.status !== poStatusFilter) return false;
      const q = poSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        po.orderNumber.toLowerCase().includes(q) ||
        (po.supplierName && po.supplierName.toLowerCase().includes(q)) ||
        po.items.some(
          (it) => it.productName.toLowerCase().includes(q) || it.barcode.toLowerCase().includes(q),
        )
      );
    }),
  );

  /** แสดงวันที่แบบไทย — ถ้าเป็น ISO จะแปลงให้อ่านง่าย */
  const displayPODate = (raw?: string) => {
    if (!raw) return "-";
    if (/^\\d{4}-\\d{2}-\\d{2}T/.test(raw.trim())) {
      try {
        return formatThaiDateTime(new Date(raw));
      } catch {
        return raw;
      }
    }
    return raw;
  };"""

    if old_filt not in text:
        print("FAIL: filteredPOs block not found", file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_filt, new_filt, 1)
    print("patched filteredPOs")

    text = text.replace(
        "<div>วันที่สร้าง: {po.createdAt}</div>",
        "<div>วันที่สร้าง: {displayPODate(po.createdAt)}</div>",
        1,
    )
    text = text.replace(
        "{po.sentViaLineAt && <div>ส่ง LINE: {po.sentViaLineAt}</div>}",
        "{po.sentViaLineAt && <div>ส่ง LINE: {displayPODate(po.sentViaLineAt)}</div>}",
        1,
    )
    if "                            {po.createdAt}" in text:
        text = text.replace(
            "                            {po.createdAt}",
            "                            {displayPODate(po.createdAt)}",
            1,
        )
        print("patched table createdAt")

    path.write_text(text)
    print("reorder.tsx OK")


if __name__ == "__main__":
    patch_store()
    patch_reorder()
    print("ALL DONE")
