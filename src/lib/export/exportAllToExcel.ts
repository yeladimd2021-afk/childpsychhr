import ExcelJS from "exceljs";
import { listDocs } from "@/lib/data/dataClient";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { ACTION_LABELS, ENTITY_LABELS, formatFieldValue } from "@/lib/domain/auditFieldLabels";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Position } from "@/lib/schemas/position";
import type { Employee } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";
import type { Unit, BudgetItem } from "@/lib/schemas/unit";
import type { FutureChange } from "@/lib/schemas/futureChange";
import type { UserProfile, UserRole } from "@/lib/schemas/user";
import type { SystemSettings } from "@/lib/schemas/systemSettings";
import type { AuditLogEntry } from "@/lib/schemas/auditLog";

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width: number }[],
  rows: Record<string, unknown>[]
) {
  const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true }] });
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
}

/** One workbook, one sheet per table — a full-system export "also to Excel" alongside the JSON
 * backup, for whoever wants to review or archive the data in spreadsheet form. */
export async function exportAllToExcel() {
  const [positions, employees, assignments, units, budgetItems, futureChanges, users, settingsRows, auditLog] =
    await Promise.all([
      listDocs<Position>("positions"),
      listDocs<Employee>("employees"),
      listDocs<Assignment>("assignments"),
      listDocs<Unit>("units"),
      listDocs<BudgetItem>("budgetItems"),
      listDocs<FutureChange>("futureChanges"),
      listDocs<Omit<UserProfile, "uid">>("users"),
      listDocs<SystemSettings>("systemSettings"),
      listDocs<AuditLogEntry>("auditLog"),
    ]);

  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const budgetItemLabelById = new Map(budgetItems.map((b) => [b.id, b.label]));

  const workbook = new ExcelJS.Workbook();

  addSheet(
    workbook,
    "תקנים",
    [
      { header: "תפקיד", key: "role", width: 20 },
      { header: "יחידה", key: "unit", width: 20 },
      { header: "סעיף תקציב", key: "budgetItem", width: 20 },
      { header: "מקור תקציבי", key: "fundingSource", width: 12 },
      { header: "אחוז משרה", key: "employmentPercent", width: 12 },
      { header: "סטטוס", key: "status", width: 12 },
      { header: "מוקפא עד", key: "frozenUntil", width: 14 },
      { header: "הערות", key: "notes", width: 30 },
    ],
    positions.map((p) => ({
      role: p.role ?? "",
      unit: p.unitId ? (unitNameById.get(p.unitId) ?? "") : "",
      budgetItem: p.budgetItemId ? (budgetItemLabelById.get(p.budgetItemId) ?? "") : "",
      fundingSource: p.fundingSource,
      employmentPercent: p.employmentPercent !== null ? `${Math.round(p.employmentPercent * 100)}%` : "",
      status: p.status,
      frozenUntil: p.frozenUntil ? new Date(p.frozenUntil).toLocaleDateString("he-IL") : "",
      notes: p.notes ?? "",
    }))
  );

  addSheet(
    workbook,
    "עובדים",
    [
      { header: "שם פרטי", key: "firstName", width: 15 },
      { header: "שם משפחה", key: "lastName", width: 15 },
      { header: "תעודת זהות", key: "idNumber", width: 14 },
      { header: "טלפון", key: "phone", width: 14 },
      { header: "מחלקה בפועל", key: "actualUnit", width: 20 },
      { header: "תפקיד בפועל", key: "actualRole", width: 18 },
      { header: "הערות", key: "notes", width: 30 },
    ],
    employees.map((e) => ({
      firstName: e.firstName,
      lastName: e.lastName,
      idNumber: e.idNumber ?? "",
      phone: e.phone ?? "",
      actualUnit: e.actualUnitId ? (unitNameById.get(e.actualUnitId) ?? "") : "",
      actualRole: e.actualRole ?? "",
      notes: e.notes ?? "",
    }))
  );

  addSheet(
    workbook,
    "שיבוצים",
    [
      { header: "עובד", key: "employee", width: 20 },
      { header: "תקן", key: "position", width: 20 },
      { header: "תאריך התחלה", key: "startDate", width: 14 },
      { header: "תאריך סיום", key: "endDate", width: 14 },
      { header: "אחוז משרה", key: "employmentPercent", width: 12 },
      { header: "הערות", key: "notes", width: 30 },
    ],
    assignments.map((a) => ({
      employee: formatEmployeeName(employeeById.get(a.employeeId)),
      position: positionById.get(a.positionId)?.role ?? "תקן",
      startDate: a.startDate ? new Date(a.startDate).toLocaleDateString("he-IL") : "",
      endDate: a.endDate ? new Date(a.endDate).toLocaleDateString("he-IL") : "",
      employmentPercent: a.employmentPercent !== null ? `${Math.round(a.employmentPercent * 100)}%` : "",
      notes: a.notes ?? "",
    }))
  );

  addSheet(
    workbook,
    "יחידות",
    [
      { header: "שם", key: "name", width: 20 },
      { header: "סדר תצוגה", key: "order", width: 10 },
      { header: "הערות", key: "notes", width: 30 },
    ],
    units.map((u) => ({ name: u.name, order: u.order, notes: u.notes ?? "" }))
  );

  addSheet(
    workbook,
    "סעיפי תקציב",
    [
      { header: "יחידה", key: "unit", width: 20 },
      { header: "קוד", key: "code", width: 12 },
      { header: "תיאור", key: "label", width: 20 },
      { header: "תקן מוקצה", key: "allocatedQuota", width: 12 },
      { header: "הערות", key: "notes", width: 30 },
    ],
    budgetItems.map((b) => ({
      unit: unitNameById.get(b.unitId) ?? "",
      code: b.code,
      label: b.label,
      allocatedQuota: b.allocatedQuota,
      notes: b.notes ?? "",
    }))
  );

  addSheet(
    workbook,
    "שינויים עתידיים",
    [
      { header: "שם פרטי", key: "firstName", width: 15 },
      { header: "שם משפחה", key: "lastName", width: 15 },
      { header: "סוג שינוי", key: "changeType", width: 16 },
      { header: "סטטוס", key: "status", width: 12 },
      { header: "תאריך כניסה לתוקף", key: "effectiveDate", width: 16 },
      { header: "אחוז משרה", key: "employmentPercent", width: 12 },
      { header: "תקן משויך", key: "relatedPosition", width: 20 },
      { header: "הערות", key: "notes", width: 30 },
    ],
    futureChanges.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      changeType: c.changeType,
      status: c.status,
      effectiveDate: c.effectiveDate
        ? new Date(c.effectiveDate).toLocaleDateString("he-IL")
        : (c.effectiveDateText ?? ""),
      employmentPercent: c.employmentPercent !== null ? `${Math.round(c.employmentPercent * 100)}%` : "",
      relatedPosition: c.relatedPositionId ? (positionById.get(c.relatedPositionId)?.role ?? "") : "",
      notes: c.notes ?? "",
    }))
  );

  addSheet(
    workbook,
    "משתמשים",
    [
      { header: "שם מלא", key: "displayName", width: 20 },
      { header: "דוא\"ל", key: "email", width: 26 },
      { header: "הרשאה", key: "role", width: 14 },
      { header: "סטטוס", key: "active", width: 10 },
    ],
    users.map((u) => ({
      displayName: u.displayName,
      email: u.email,
      role: ROLE_LABELS[u.role as UserRole] ?? u.role,
      active: u.active ? "פעיל" : "מושבת",
    }))
  );

  if (settingsRows.length > 0) {
    const s = settingsRows[0];
    addSheet(
      workbook,
      "הגדרות מערכת",
      [
        { header: "הגדרה", key: "label", width: 30 },
        { header: "ערך (ימים)", key: "value", width: 14 },
      ],
      [
        { label: "סף התיישנות תקן פנוי — דורש תשומת לב", value: s.vacancyThresholds.yellowDays },
        { label: "סף התיישנות תקן פנוי — עדיפות גבוהה", value: s.vacancyThresholds.orangeDays },
        { label: "סף התיישנות תקן פנוי — קריטי", value: s.vacancyThresholds.redDays },
        { label: "חלון שינוי כוח אדם — קריטי", value: s.leavingWindows.criticalDays },
        { label: "חלון שינוי כוח אדם — דחוף", value: s.leavingWindows.urgentDays },
        { label: "חלון שינוי כוח אדם — תכנון", value: s.leavingWindows.planningDays },
      ]
    );
  }

  addSheet(
    workbook,
    "יומן שינויים",
    [
      { header: "סוג רשומה", key: "entityType", width: 14 },
      { header: "רשומה", key: "entityLabel", width: 24 },
      { header: "פעולה", key: "action", width: 12 },
      { header: "בוצע ע\"י", key: "changedByName", width: 18 },
      { header: "תאריך ושעה", key: "changedAt", width: 18 },
      { header: "שינויים", key: "changes", width: 50 },
    ],
    auditLog.map((entry) => ({
      entityType: ENTITY_LABELS[entry.entityType],
      entityLabel: entry.entityLabel,
      action: ACTION_LABELS[entry.action] ?? entry.action,
      changedByName: entry.changedByName,
      changedAt: new Date(entry.changedAt).toLocaleString("he-IL"),
      changes: entry.changes
        .map((c) => `${c.field}: ${formatFieldValue(c.field, c.oldValue)} ← ${formatFieldValue(c.field, c.newValue)}`)
        .join(" · "),
    }))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `מערכת-תקנים-כל-הטבלאות-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
