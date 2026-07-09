import ExcelJS from "exceljs";
import type { Position } from "@/lib/schemas/position";
import type { Unit } from "@/lib/schemas/unit";
import type { Employee } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";

export async function exportPositionsToExcel(
  positions: Position[],
  units: Unit[],
  employees: Employee[],
  activeAssignmentByPositionId: Map<string, Assignment>
) {
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("עובדים ותקנים", { views: [{ rightToLeft: true }] });

  sheet.columns = [
    { header: "תפקיד", key: "role", width: 20 },
    { header: "יחידה", key: "unit", width: 22 },
    { header: "מדינה / קרן", key: "fundingSource", width: 12 },
    { header: "אחוזי משרה", key: "employmentPercent", width: 12 },
    { header: "סטטוס", key: "status", width: 12 },
    { header: "עובד נוכחי", key: "employeeName", width: 22 },
    { header: "מס' ת.ז.", key: "idNumber", width: 14 },
    { header: "הערות", key: "notes", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const p of positions) {
    const assignment = activeAssignmentByPositionId.get(p.id);
    const employee = assignment ? employeeById.get(assignment.employeeId) : null;
    sheet.addRow({
      role: p.role ?? "",
      unit: p.unitId ? (unitNameById.get(p.unitId) ?? "") : "",
      fundingSource: p.fundingSource,
      employmentPercent: p.employmentPercent !== null ? `${Math.round(p.employmentPercent * 100)}%` : "",
      status: p.status,
      employeeName: employee ? formatEmployeeName(employee) : "",
      idNumber: employee?.idNumber ?? "",
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
  a.download = `עובדים-ותקנים-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
