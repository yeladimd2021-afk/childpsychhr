import type { Position } from "@/lib/schemas/position";
import type { PositionException, EmployeeException } from "@/lib/domain/exceptions";
import type { VacancyAgeTier } from "@/lib/domain/actionQueue";
import { formatEmployeeName } from "@/lib/schemas/employee";

export type CriticalAlert = {
  id: string;
  category: "חריגת נתונים" | "מקור תקציבי חסר" | "תקן פנוי קריטי" | "שדה חובה חסר";
  message: string;
  href: string;
};

/** Focused "what's actually broken or missing" list — narrower than the action queue, which
 * also includes non-broken-but-worth-doing items like stale vacancy reviews. Every alert here
 * is a genuine data-quality or compliance gap. */
export function computeCriticalAlerts(params: {
  positions: Position[];
  positionExceptions: PositionException[];
  employeeExceptions: EmployeeException[];
  vacancyAgeTiers: VacancyAgeTier[];
  unitNameById: Map<string, string>;
}): CriticalAlert[] {
  const { positions, positionExceptions, employeeExceptions, vacancyAgeTiers, unitNameById } = params;
  const alerts: CriticalAlert[] = [];

  const positionHref = (p: Position) =>
    p.role ? `/positions?tab=positions&search=${encodeURIComponent(p.role)}` : "/positions?tab=positions";

  for (const e of positionExceptions) {
    alerts.push({
      id: `pos-exc-${e.position.id}`,
      category: "חריגת נתונים",
      message: `${e.position.role ?? "תקן"} — ${e.reason}`,
      href: positionHref(e.position),
    });
  }
  for (const e of employeeExceptions) {
    alerts.push({
      id: `emp-exc-${e.employee.id}`,
      category: "חריגת נתונים",
      message: `${formatEmployeeName(e.employee)} — ${e.reason}`,
      // Searching by the duplicated ID number itself (not the name) surfaces both conflicting
      // employees at once — that's the whole point of flagging a duplicate.
      href: e.employee.idNumber
        ? `/positions?tab=employees&search=${encodeURIComponent(e.employee.idNumber)}`
        : `/positions?tab=employees&search=${encodeURIComponent(formatEmployeeName(e.employee))}`,
    });
  }

  for (const p of positions) {
    if (p.unitId && !p.budgetItemId) {
      alerts.push({
        id: `no-budget-${p.id}`,
        category: "מקור תקציבי חסר",
        message: `${p.role ?? "תקן"} ביחידה ${unitNameById.get(p.unitId) ?? "לא ידועה"} — ללא סעיף תקציב משויך`,
        href: positionHref(p),
      });
    }
    if (!p.role) {
      alerts.push({
        id: `no-role-${p.id}`,
        category: "שדה חובה חסר",
        message: `תקן ללא הגדרת תפקיד${p.unitId ? ` ביחידה ${unitNameById.get(p.unitId) ?? ""}` : ""}`,
        href: "/positions?tab=positions",
      });
    }
  }

  for (const t of vacancyAgeTiers.filter((t) => t.severity === "red")) {
    alerts.push({
      id: `stale-${t.position.id}`,
      category: "תקן פנוי קריטי",
      message: `${t.position.role ?? "תקן"} פנוי ${t.daysVacant} ימים`,
      href: "/reports",
    });
  }

  return alerts;
}
