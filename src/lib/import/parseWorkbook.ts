import ExcelJS from "exceljs";
import {
  findPositionsSheet,
  parsePositionsSheet,
  SOURCE_SHEET_NAME,
  validateHeaders,
  type ParsedPositionRow,
} from "./parsePositionsSheet";
import {
  CHANGES_SHEET_NAME,
  findChangesSheet,
  parseFutureChangesSheet,
  type ParsedFutureChangeRow,
} from "./parseFutureChangesSheet";

export type WorkbookParseResult =
  | { ok: true; data: ParseSuccess }
  | { ok: false; error: string };

export type ParseSuccess = {
  positionsSheetName: string;
  positionRows: ParsedPositionRow[];
  headerWarnings: string[];
  futureChangesSheetFound: boolean;
  futureChangeRows: ParsedFutureChangeRow[];
  futureChangesExcludedCount: number;
};

export async function parseWorkbookBuffer(
  buffer: ArrayBuffer | Buffer
): Promise<WorkbookParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as ArrayBuffer);
  } catch {
    return { ok: false, error: "לא ניתן לקרוא את הקובץ — ודא/י שזהו קובץ Excel תקין ולא פגום" };
  }

  const positionsSheet = findPositionsSheet(workbook);
  if (!positionsSheet) {
    return {
      ok: false,
      error: `לא נמצא גיליון בשם "${SOURCE_SHEET_NAME}" בקובץ. הגיליונות שנמצאו: ${workbook.worksheets
        .map((ws) => ws.name)
        .join(", ")}`,
    };
  }

  let positionRows: ParsedPositionRow[];
  let headerWarnings: string[];
  try {
    headerWarnings = validateHeaders(positionsSheet);
    positionRows = parsePositionsSheet(positionsSheet);
  } catch (err) {
    return { ok: false, error: `שגיאה בעיבוד גיליון "${SOURCE_SHEET_NAME}": ${(err as Error).message}` };
  }

  if (positionRows.length === 0) {
    return {
      ok: false,
      error: `הגיליון "${SOURCE_SHEET_NAME}" נמצא אך לא נמצאו בו שורות נתונים (מתחת לשורה 5)`,
    };
  }

  let futureChangeRows: ParsedFutureChangeRow[] = [];
  let futureChangesExcludedCount = 0;
  let futureChangesSheetFound = false;
  const changesSheet = findChangesSheet(workbook);
  if (changesSheet) {
    try {
      const result = parseFutureChangesSheet(changesSheet);
      futureChangeRows = result.rows;
      futureChangesExcludedCount = result.excludedCount;
      futureChangesSheetFound = true;
    } catch (err) {
      headerWarnings.push(
        `לא ניתן היה לקרוא את גיליון "${CHANGES_SHEET_NAME}": ${(err as Error).message}`
      );
    }
  }

  return {
    ok: true,
    data: {
      positionsSheetName: positionsSheet.name,
      positionRows,
      headerWarnings,
      futureChangesSheetFound,
      futureChangeRows,
      futureChangesExcludedCount,
    },
  };
}
