import ExcelJS from "exceljs";
import type { Unit } from "@/lib/schemas/unit";
import type { BudgetItemStats } from "@/lib/domain/aggregation";
import { round2 } from "@/lib/domain/aggregation";

export async function exportVacancyReportToExcel(vacantItemStats: BudgetItemStats[], units: Unit[]) {
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("סעיפי תקציב עם יתרה פנויה", { views: [{ rightToLeft: true }] });

  sheet.columns = [
    { header: "מספר סעיף", key: "code", width: 14 },
    { header: "שם / תיאור", key: "label", width: 24 },
    { header: "יחידה", key: "unit", width: 22 },
    { header: "מקור תקציב", key: "fundingSource", width: 12 },
    { header: "מאושר", key: "allocatedQuota", width: 10 },
    { header: "מאויש", key: "occupied", width: 10 },
    { header: "פנוי", key: "vacant", width: 10 },
    { header: "הערות", key: "notes", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const s of vacantItemStats) {
    sheet.addRow({
      code: s.budgetItem.code,
      label: s.budgetItem.label,
      unit: unitNameById.get(s.budgetItem.unitId) ?? "",
      fundingSource: s.budgetItem.fundingSource,
      allocatedQuota: round2(s.budgetItem.allocatedQuota),
      occupied: round2(s.occupied),
      vacant: round2(s.vacant),
      notes: s.budgetItem.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `סעיפי-תקציב-פנויים-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
