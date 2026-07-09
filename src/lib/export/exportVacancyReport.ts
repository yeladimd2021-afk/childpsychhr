import ExcelJS from "exceljs";
import type { Position } from "@/lib/schemas/position";
import type { Unit } from "@/lib/schemas/unit";

export async function exportVacancyReportToExcel(vacantPositions: Position[], units: Unit[]) {
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("תקנים פנויים", { views: [{ rightToLeft: true }] });

  sheet.columns = [
    { header: "תפקיד", key: "role", width: 20 },
    { header: "יחידה", key: "unit", width: 22 },
    { header: "מדינה / קרן", key: "fundingSource", width: 12 },
    { header: "אחוזי משרה", key: "employmentPercent", width: 12 },
    { header: "הערות", key: "notes", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const p of vacantPositions) {
    sheet.addRow({
      role: p.role ?? "",
      unit: p.unitId ? (unitNameById.get(p.unitId) ?? "") : "",
      fundingSource: p.fundingSource,
      employmentPercent: p.employmentPercent !== null ? `${Math.round(p.employmentPercent * 100)}%` : "",
      notes: p.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `תקנים-פנויים-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
