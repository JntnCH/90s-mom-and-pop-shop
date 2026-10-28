/**
 * One-shot fix: wrap saveGoogleSheetsConfigFn / testGoogleSheetsConnectionFn
 * args in { data: ... } so TanStack Start server handlers receive data correctly.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/components/sheets/GoogleSheetsSyncTab.tsx");
let text = fs.readFileSync(file, "utf8");

if (text === "PLACEHOLDER" || text === "SEE_ARTIFACT" || text.length < 1000) {
  console.error("GoogleSheetsSyncTab.tsx is corrupted (placeholder). Restore from git history first.");
  process.exit(1);
}

const oldSave = `const res = await saveGoogleSheetsConfigFn({
        jsonKey: saInputMode === "json" ? saJsonInput : undefined,
        clientEmail: saInputMode === "manual" ? saEmailInput : undefined,
        privateKey: saInputMode === "manual" ? saKeyInput : undefined,
        spreadsheetId: saSpreadsheetInput,
      });`;

const newSave = `const res = await saveGoogleSheetsConfigFn({
        data: {
          jsonKey: saInputMode === "json" ? saJsonInput : undefined,
          clientEmail: saInputMode === "manual" ? saEmailInput : undefined,
          privateKey: saInputMode === "manual" ? saKeyInput : undefined,
          spreadsheetId: saSpreadsheetInput,
        },
      });`;

const oldTest = `const res = await testGoogleSheetsConnectionFn({
        spreadsheetId: idToTest,
      });`;

const newTest = `const res = await testGoogleSheetsConnectionFn({
        data: {
          spreadsheetId: idToTest,
        },
      });`;

let changed = false;
if (text.includes(oldSave)) {
  text = text.replace(oldSave, newSave);
  changed = true;
  console.log("Fixed saveGoogleSheetsConfigFn call");
} else if (text.includes("saveGoogleSheetsConfigFn({\n        data:")) {
  console.log("save already wrapped");
} else {
  console.warn("save pattern not found");
}

if (text.includes(oldTest)) {
  text = text.replace(oldTest, newTest);
  changed = true;
  console.log("Fixed testGoogleSheetsConnectionFn call");
} else if (text.includes("testGoogleSheetsConnectionFn({\n        data:")) {
  console.log("test already wrapped");
} else {
  console.warn("test pattern not found");
}

if (changed) {
  fs.writeFileSync(file, text);
  console.log("Wrote", file);
} else {
  console.log("No changes needed or patterns missing");
}
