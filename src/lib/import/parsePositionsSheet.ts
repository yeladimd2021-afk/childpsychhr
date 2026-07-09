import type ExcelJS from "exceljs";
import {
  cleanText,
  looksLikeBudgetCode,
  normalizeBudgetItemRaw,
  normalizeDateCell,
  normalizeEmployeeStatus,
  normalizeEmploymentPercent,
  normalizeFundingSource,
  normalizeIdNumber,
  splitFullName,
} from "./normalize";

export const SOURCE_SHEET_NAME = "פירוט תקנים";
const HEADER_ROW = 5;
const FIRST_DATA_ROW = 6;

export type ParsedPositionRow = {
  rowNumber: number;
  firstName: string | null;
  lastName: string | null;
  idNumber: string | null;
  fundingSource: "מדינה" | "קרן" | "אחר";
  startDate: number | null;
  startDateText: string | null;
  unitNameRaw: string | null;
  budgetItemRaw: string | null;
  budgetItemLooksLikeCode: boolean;
  employmentPercent: number | null;
  previousEmploymentPercent: number | null;
  role: string | null;
  employeeStatus: "פעיל" | "עוזב" | "מועמד" | "לא פעיל";
  notes: string | null;
  warnings: string[];
};

export function findPositionsSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const exact = workbook.getWorksheet(SOURCE_SHEET_NAME);
  if (exact) return exact;
  return (
    workbook.worksheets.find((ws) => ws.name.replace(/\s+/g, " ").trim() === SOURCE_SHEET_NAME) ??
    null
  );
}

const EXPECTED_HEADERS = [
  "שם העובד",
  "מס' ת.ז.",
  "מדינה / קרן",
  "החל מ-",
  "סעיף תקציב",
  "אחוזי משרה",
  "מחלקה",
  "תפקיד",
  "תקן מאוייש",
  "אחוז  משרה שהיה",
  "פירוט / הערות",
];

/** Confirms row 5 still looks like the columns we know how to read — surfaced as warnings,
 * not hard failures, since minor rewording of a header shouldn't block the whole import. */
export function validateHeaders(sheet: ExcelJS.Worksheet): string[] {
  const warnings: string[] = [];
  const headerRow = sheet.getRow(HEADER_ROW);
  EXPECTED_HEADERS.forEach((expected, index) => {
    const col = index + 1;
    const actual = cleanText(headerRow.getCell(col).value);
    if (!actual) {
      warnings.push(`עמודה ${col} בשורת הכותרות (שורה ${HEADER_ROW}) ריקה — ציפינו ל-"${expected}"`);
    } else if (actual.replace(/\s+/g, "") !== expected.replace(/\s+/g, "")) {
      warnings.push(
        `עמודה ${col} בשורת הכותרות: נמצא "${actual}", ציפינו ל-"${expected}" — ייתכן שהמבנה השתנה`
      );
    }
  });
  return warnings;
}

export function parsePositionsSheet(sheet: ExcelJS.Worksheet): ParsedPositionRow[] {
  const rows: ParsedPositionRow[] = [];

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const get = (col: number) => row.getCell(col).value;

    const employeeNameRaw = cleanText(get(1));
    const idNumberRaw = get(2);
    const fundingRaw = get(3);
    const dateRaw = get(4);
    const budgetRaw = get(5);
    const percentRaw = get(6);
    const unitRaw = get(7);
    const roleRaw = get(8);
    const occupancyRaw = get(9);
    const prevPercentRaw = get(10);
    const notesRaw = get(11);

    const hasAnyOtherField = [
      idNumberRaw,
      fundingRaw,
      dateRaw,
      budgetRaw,
      percentRaw,
      unitRaw,
      roleRaw,
      occupancyRaw,
      prevPercentRaw,
      notesRaw,
    ].some((v) => v !== null && v !== undefined && v !== "");

    if (!employeeNameRaw && !hasAnyOtherField) continue; // fully empty row

    const warnings: string[] = [];
    const idNumber = normalizeIdNumber(idNumberRaw);
    const funding = normalizeFundingSource(fundingRaw);
    if (funding.needsReview) {
      warnings.push(`מקור תקציבי לא ברור: "${cleanText(fundingRaw) ?? ""}"`);
    }
    const { date: startDate, text: startDateText } = normalizeDateCell(dateRaw);
    const budgetItemRaw = normalizeBudgetItemRaw(budgetRaw);
    const budgetItemLooksLikeCode = looksLikeBudgetCode(budgetItemRaw);
    if (budgetItemRaw && !budgetItemLooksLikeCode) {
      warnings.push(`סעיף תקציב לא מספרי: "${budgetItemRaw}"`);
    }
    const unitNameRaw = cleanText(unitRaw);
    const employmentPercent = normalizeEmploymentPercent(percentRaw);
    const previousEmploymentPercent = normalizeEmploymentPercent(prevPercentRaw);
    const role = cleanText(roleRaw);
    const employeeStatus = normalizeEmployeeStatus(occupancyRaw);
    const notes = cleanText(notesRaw);
    const { firstName, lastName } = splitFullName(employeeNameRaw);

    const incompleteRow = !!employeeNameRaw && !unitNameRaw && !role && employmentPercent === null;
    if (incompleteRow && !idNumber) {
      warnings.push("שורה עם שם עובד בלבד — ייתכן שזו הערה ולא רשומת עובד, נא לבדוק");
    } else if (incompleteRow) {
      warnings.push("חסרים פרטי מחלקה/תפקיד/היקף משרה — נא להשלים ידנית");
    }
    if (!employeeNameRaw) {
      warnings.push("שורה ללא שם עובד — נא להשלים ידנית לאחר הייבוא");
    }

    rows.push({
      rowNumber,
      firstName,
      lastName,
      idNumber,
      fundingSource: funding.value,
      startDate,
      startDateText,
      unitNameRaw,
      budgetItemRaw,
      budgetItemLooksLikeCode,
      employmentPercent,
      previousEmploymentPercent,
      role,
      employeeStatus,
      notes,
      warnings,
    });
  }

  return rows;
}

export { HEADER_ROW };
