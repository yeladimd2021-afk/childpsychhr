import type { BudgetItem } from "@/lib/schemas/unit";
import type { BudgetItemException, EmployeeException } from "@/lib/domain/exceptions";
import type { VacancyAgeTier } from "@/lib/domain/actionQueue";
import { formatEmployeeName } from "@/lib/schemas/employee";

export type CriticalAlert = {
  id: string;
  category: "חריגת נתונים" | "תקן פנוי קריטי";
  message: string;
  href: string;
};

/** Focused "what's actually broken or missing" list — narrower than the action queue, which
 * also includes non-broken-but-worth-doing items. Every alert here is a genuine data-quality
 * or compliance gap. */
export function computeCriticalAlerts(params: {
  budgetItemExceptions: BudgetItemException[];
  employeeExceptions: EmployeeException[];
  vacancyAgeTiers: VacancyAgeTier[];
  unitNameById: Map<string, string>;
}): CriticalAlert[] {
  const { budgetItemExceptions, employeeExceptions, vacancyAgeTiers, unitNameById } = params;
  const alerts: CriticalAlert[] = [];

  const budgetItemHref = (b: BudgetItem) => `/budget-items?search=${encodeURIComponent(b.code)}`;

  budgetItemExceptions.forEach((e, i) => {
    alerts.push({
      id: `bi-exc-${e.budgetItem.id}-${i}`,
      category: "חריגת נתונים",
      message: `${e.budgetItem.code} · ${e.budgetItem.label} — ${e.reason}`,
      href: budgetItemHref(e.budgetItem),
    });
  });
  for (const e of employeeExceptions) {
    alerts.push({
      id: `emp-exc-${e.employee.id}`,
      category: "חריגת נתונים",
      message: `${formatEmployeeName(e.employee)} — ${e.reason}`,
      // Searching by the duplicated ID number itself (not the name) surfaces both conflicting
      // employees at once — that's the whole point of flagging a duplicate.
      href: e.employee.idNumber
        ? `/budget-items?tab=employees&search=${encodeURIComponent(e.employee.idNumber)}`
        : `/budget-items?tab=employees&search=${encodeURIComponent(formatEmployeeName(e.employee))}`,
    });
  }

  for (const t of vacancyAgeTiers.filter((t) => t.severity === "red")) {
    alerts.push({
      id: `stale-${t.budgetItem.id}`,
      category: "תקן פנוי קריטי",
      message: `${t.budgetItem.code} · ${t.budgetItem.label}${
        t.budgetItem.unitId ? ` ביחידה ${unitNameById.get(t.budgetItem.unitId) ?? ""}` : ""
      } — פנוי ${t.daysVacant} ימים`,
      href: "/reports",
    });
  }

  return alerts;
}
