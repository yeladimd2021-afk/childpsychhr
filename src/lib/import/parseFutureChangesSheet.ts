import type ExcelJS from "exceljs";
import {
  cleanText,
  normalizeDateCell,
  normalizeEmploymentPercent,
  normalizeFundingSourceNullable,
} from "./normalize";
import type { FundingSource } from "@/lib/schemas/position";

export const CHANGES_SHEET_NAME = "שינויים בקרוב";

const SECTION_LABELS = {
  עוזבים: "עזיבה",
  חדשים: "קליטה",
} as const;

/** Rows under this label describe positions the department doesn't own — kept out of the
 * actionable future-changes list, just surfaced as a count so nothing is silently dropped. */
const EXCLUDED_SECTION_LABEL = "לא תקנים שלנו";

export type ParsedFutureChangeRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  employmentPercent: number | null;
  effectiveDate: number | null;
  effectiveDateText: string | null;
  fundingSource: FundingSource | null;
  positionRef: string | null;
  changeType: "עזיבה" | "קליטה";
  notes: string | null;
  warnings: string[];
};

export function findChangesSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const exact = workbook.worksheets.find(
    (ws) => ws.name.replace(/\s+/g, " ").trim() === CHANGES_SHEET_NAME
  );
  return exact ?? null;
}

export function parseFutureChangesSheet(sheet: ExcelJS.Worksheet): {
  rows: ParsedFutureChangeRow[];
  excludedCount: number;
} {
  const rows: ParsedFutureChangeRow[] = [];
  let excludedCount = 0;
  let currentSection: keyof typeof SECTION_LABELS | typeof EXCLUDED_SECTION_LABEL | null = null;

  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const get = (col: number) => row.getCell(col).value;

    const colA = cleanText(get(1));
    const colB = cleanText(get(2));

    if (colA === "עוזבים" || colB === "עוזבים") {
      currentSection = "עוזבים";
      continue;
    }
    if (colA === "חדשים" || colB === "חדשים") {
      currentSection = "חדשים";
      continue;
    }
    if (colA === EXCLUDED_SECTION_LABEL || colB === EXCLUDED_SECTION_LABEL) {
      currentSection = EXCLUDED_SECTION_LABEL;
      continue;
    }
    if (colA === "שם") continue; // repeated header row inside each section

    if (!currentSection) continue;

    const firstName = colA;
    const lastName = colB;
    const percentRaw = get(3);
    const dateRaw = get(4);
    const fundingRaw = get(5);
    const positionRefRaw = get(6);
    const notesRaw = get(7);

    const hasAnyData = [
      firstName,
      lastName,
      percentRaw,
      dateRaw,
      fundingRaw,
      positionRefRaw,
      notesRaw,
    ].some((v) => v !== null && v !== undefined && v !== "");
    if (!hasAnyData) continue;

    if (currentSection === EXCLUDED_SECTION_LABEL) {
      excludedCount += 1;
      continue;
    }

    const warnings: string[] = [];
    if (!firstName || !lastName) {
      warnings.push("חסר שם פרטי או שם משפחה — נא להשלים ידנית");
    }
    const { date: effectiveDate, text: effectiveDateText } = normalizeDateCell(dateRaw);
    const funding = normalizeFundingSourceNullable(fundingRaw);
    if (funding.needsReview) {
      warnings.push(`מקור תקציבי לא ברור: "${cleanText(fundingRaw) ?? ""}"`);
    }
    const positionRef = cleanText(positionRefRaw);

    rows.push({
      rowNumber,
      firstName: firstName ?? "(ללא שם)",
      lastName: lastName ?? "",
      employmentPercent: normalizeEmploymentPercent(percentRaw),
      effectiveDate,
      effectiveDateText,
      fundingSource: funding.value,
      positionRef,
      changeType: SECTION_LABELS[currentSection],
      notes: cleanText(notesRaw),
      warnings,
    });
  }

  return { rows, excludedCount };
}
