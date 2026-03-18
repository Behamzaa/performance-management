import * as XLSX from "xlsx";
import { Kpi, Project } from "./types";
import { inferLowerIsBetter } from "./kpi-status";

interface ParseResult {
  kpis: Omit<Kpi, "id" | "created_at" | "updated_at" | "import_snapshot_id">[];
  projects: Omit<Project, "id" | "created_at" | "updated_at" | "import_snapshot_id">[];
  warnings: string[];
}

function findSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  // Try to find sheet matching MA H126 pattern
  for (const name of workbook.SheetNames) {
    if (name.includes("MA") && (name.includes("H1") || name.includes("H126"))) {
      return workbook.Sheets[name];
    }
  }
  // Fallback: first sheet
  if (workbook.SheetNames.length === 1) {
    return workbook.Sheets[workbook.SheetNames[0]];
  }
  return null;
}

function getCellValue(sheet: XLSX.WorkSheet, row: number, col: number): string | number | null {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[cellAddress];
  if (!cell) return null;
  if (cell.v === undefined || cell.v === null) return null;
  return cell.v;
}

function tryParseNumber(val: string | number | null): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const str = String(val).trim();
  if (str === "" || str === "-" || str === "n/a" || str === "N/A" || str.includes("missing") || str.includes("data")) {
    return null;
  }
  // Handle percentage strings like "85%"
  if (str.endsWith("%")) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? null : num / 100;
  }
  const num = parseFloat(str.replace(/,/g, ""));
  return isNaN(num) ? null : num;
}

function isCompositeValue(val: string | number | null): boolean {
  if (val === null || typeof val === "number") return false;
  const str = String(val);
  return str.includes("/") && str.split("/").length >= 3;
}

export function parseMasterplan(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = findSheet(workbook);
  const warnings: string[] = [];

  if (!sheet) {
    throw new Error("Could not find a sheet matching 'MA H126'. Available sheets: " + workbook.SheetNames.join(", "));
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const maxRow = range.e.r;

  // Column indices (0-based): B=1, C=2, D=3, E=4...N=13, O=14...
  const COL_BLOCK = 1;       // B
  const COL_NAME = 2;        // C
  const COL_LINK = 3;        // D
  const COL_BASE_OCT = 4;    // E
  const COL_BASE_NOV = 5;    // F
  const COL_BASE_DEC = 6;    // G
  const COL_TARGET_JAN = 7;  // H
  const COL_TARGET_FEB = 8;  // I
  const COL_TARGET_MAR = 9;  // J
  const COL_TARGET_APR = 10; // K
  const COL_TARGET_MAY = 11; // L
  const COL_TARGET_JUN = 12; // M
  const COL_OWNER = 13;      // N
  const COL_WEEK_START = 14; // O (W1)
  const COL_FINAL_JAN = 40;  // AO
  const COL_FINAL_FEB = 41;  // AP
  const COL_FINAL_MAR = 42;  // AQ
  const COL_FINAL_APR = 43;  // AR
  const COL_FINAL_MAY = 44;  // AS
  const COL_FINAL_JUN = 45;  // AT
  const COL_VARIATION = 46;  // AU
  const COL_PERFORMANCE = 47; // AV

  const kpis: ParseResult["kpis"] = [];
  const projects: ParseResult["projects"] = [];

  // Detect where projects start by looking for the project header row
  let projectStartRow = -1;
  for (let r = 1; r <= maxRow; r++) {
    const colA = getCellValue(sheet, r, 0);
    const colC = getCellValue(sheet, r, 2);
    if (
      (colA !== null && String(colA).toLowerCase().includes("x")) ||
      (colC !== null && String(colC).toLowerCase().includes("actual project name"))
    ) {
      projectStartRow = r + 1; // Data starts on next row
      break;
    }
  }

  // Parse KPIs (rows 1 to projectStartRow-2 or row 81)
  let currentBlock = "";
  const kpiEndRow = projectStartRow > 0 ? projectStartRow - 2 : Math.min(81, maxRow);

  for (let r = 1; r <= kpiEndRow; r++) {
    const blockVal = getCellValue(sheet, r, COL_BLOCK);
    const nameVal = getCellValue(sheet, r, COL_NAME);

    if (blockVal) {
      const blockStr = String(blockVal).trim();
      if (blockStr && blockStr !== "Block") {
        currentBlock = blockStr;
      }
    }

    if (!nameVal || !currentBlock) continue;
    const name = String(nameVal).trim();
    if (!name || name === "KPIs") continue;

    // Determine if this is a sub-label row (indented, like "XL", "Regions", "SMB")
    const isSubLabel = !blockVal && name.length < 30 &&
      ["XL", "Regions", "SMB", "TA"].includes(name);

    // Parse weekly actuals
    const weeklyActuals: { week: number; value: number | null }[] = [];
    for (let w = 0; w < 26; w++) {
      const val = getCellValue(sheet, r, COL_WEEK_START + w);
      const numVal = tryParseNumber(val);
      if (numVal !== null) {
        weeklyActuals.push({ week: w + 1, value: numVal });
      }
    }

    // Detect composite values
    const rawValues: Record<string, string> = {};
    const targets = [
      getCellValue(sheet, r, COL_TARGET_JAN),
      getCellValue(sheet, r, COL_TARGET_FEB),
    ];
    const hasComposite = targets.some(isCompositeValue) ||
      weeklyActuals.length === 0 && getCellValue(sheet, r, COL_WEEK_START) !== null &&
      isCompositeValue(getCellValue(sheet, r, COL_WEEK_START));

    if (hasComposite) {
      rawValues.type = "composite";
      for (let w = 0; w < 26; w++) {
        const val = getCellValue(sheet, r, COL_WEEK_START + w);
        if (val !== null) rawValues[`w${w + 1}`] = String(val);
      }
    }

    // Detect format
    let format: Kpi["format"] = "num";
    const sampleVal = tryParseNumber(getCellValue(sheet, r, COL_TARGET_JAN));
    if (sampleVal !== null) {
      if (sampleVal > 0 && sampleVal < 1) format = "pct";
      if (sampleVal > 0 && sampleVal < 0.01) format = "pct4";
    }
    if (name.toLowerCase().includes("revenue") || name.toLowerCase().includes("profit") ||
        name.toLowerCase().includes("investment")) {
      format = "currency";
    }

    kpis.push({
      block: currentBlock,
      name,
      sub_label: isSubLabel ? name : null,
      parent_kpi_id: null,
      owner: String(getCellValue(sheet, r, COL_OWNER) ?? "").trim() || null,
      link: String(getCellValue(sheet, r, COL_LINK) ?? "").trim() || null,
      format: Object.keys(rawValues).length > 0 ? "composite" : format,
      lower_is_better: inferLowerIsBetter(name),
      baseline_oct: tryParseNumber(getCellValue(sheet, r, COL_BASE_OCT)),
      baseline_nov: tryParseNumber(getCellValue(sheet, r, COL_BASE_NOV)),
      baseline_dec: tryParseNumber(getCellValue(sheet, r, COL_BASE_DEC)),
      target_jan: tryParseNumber(getCellValue(sheet, r, COL_TARGET_JAN)),
      target_feb: tryParseNumber(getCellValue(sheet, r, COL_TARGET_FEB)),
      target_mar: tryParseNumber(getCellValue(sheet, r, COL_TARGET_MAR)),
      target_apr: tryParseNumber(getCellValue(sheet, r, COL_TARGET_APR)),
      target_may: tryParseNumber(getCellValue(sheet, r, COL_TARGET_MAY)),
      target_jun: tryParseNumber(getCellValue(sheet, r, COL_TARGET_JUN)),
      weekly_actuals: weeklyActuals,
      final_jan: tryParseNumber(getCellValue(sheet, r, COL_FINAL_JAN)),
      final_feb: tryParseNumber(getCellValue(sheet, r, COL_FINAL_FEB)),
      final_mar: tryParseNumber(getCellValue(sheet, r, COL_FINAL_MAR)),
      final_apr: tryParseNumber(getCellValue(sheet, r, COL_FINAL_APR)),
      final_may: tryParseNumber(getCellValue(sheet, r, COL_FINAL_MAY)),
      final_jun: tryParseNumber(getCellValue(sheet, r, COL_FINAL_JUN)),
      variation: tryParseNumber(getCellValue(sheet, r, COL_VARIATION)),
      performance: String(getCellValue(sheet, r, COL_PERFORMANCE) ?? "").trim() || null,
      raw_values: Object.keys(rawValues).length > 0 ? rawValues : null,
      sort_order: r,
    });
  }

  // Parse Projects (from projectStartRow onwards)
  if (projectStartRow > 0) {
    let currentProjectBlock = "";
    for (let r = projectStartRow; r <= maxRow; r++) {
      const colA = getCellValue(sheet, r, 0);
      const blockVal = getCellValue(sheet, r, COL_BLOCK);
      const nameVal = getCellValue(sheet, r, COL_NAME);

      if (blockVal) {
        const blockStr = String(blockVal).trim();
        if (blockStr && blockStr !== "Block") {
          currentProjectBlock = blockStr;
        }
      }

      if (!nameVal || !currentProjectBlock) continue;
      const name = String(nameVal).trim();
      if (!name || name === "Actual Project Name") continue;

      // For projects, columns are different:
      // H=Jan status, I=Feb status, etc. N=Owner, Col after owner = Comment
      const commentCol = 14; // O column for comments

      projects.push({
        priority: typeof colA === "number" ? colA : null,
        block: currentProjectBlock,
        name,
        link: String(getCellValue(sheet, r, COL_LINK) ?? "").trim() || null,
        owner: String(getCellValue(sheet, r, COL_OWNER) ?? "").trim() || null,
        status_jan: normalizeStatus(getCellValue(sheet, r, COL_TARGET_JAN)),
        status_feb: normalizeStatus(getCellValue(sheet, r, COL_TARGET_FEB)),
        status_mar: normalizeStatus(getCellValue(sheet, r, COL_TARGET_MAR)),
        status_apr: normalizeStatus(getCellValue(sheet, r, COL_TARGET_APR)),
        status_may: normalizeStatus(getCellValue(sheet, r, COL_TARGET_MAY)),
        status_jun: normalizeStatus(getCellValue(sheet, r, COL_TARGET_JUN)),
        comment_jan: String(getCellValue(sheet, r, commentCol) ?? "").trim() || null,
        comment_feb: String(getCellValue(sheet, r, commentCol + 1) ?? "").trim() || null,
        comment_mar: String(getCellValue(sheet, r, commentCol + 2) ?? "").trim() || null,
        comment_apr: String(getCellValue(sheet, r, commentCol + 3) ?? "").trim() || null,
        comment_may: String(getCellValue(sheet, r, commentCol + 4) ?? "").trim() || null,
        comment_jun: String(getCellValue(sheet, r, commentCol + 5) ?? "").trim() || null,
        sort_order: r,
      });
    }
  }

  if (kpis.length === 0) {
    warnings.push("No KPIs found in the spreadsheet.");
  }
  if (projects.length === 0) {
    warnings.push("No projects found in the spreadsheet.");
  }

  return { kpis, projects, warnings };
}

function normalizeStatus(val: string | number | null): string | null {
  if (val === null) return null;
  const str = String(val).trim().toUpperCase();
  if (str === "Y" || str === "YES" || str === "DONE") return "Y";
  if (str === "N" || str === "NO" || str === "NOT STARTED") return "N";
  if (str === "WIP" || str === "IN PROGRESS") return "WIP";
  return str || null;
}
