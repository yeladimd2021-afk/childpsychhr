import type { BudgetItem } from "@/lib/schemas/unit";
import type { Employee } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";
import { computeBudgetItemStats } from "@/lib/domain/aggregation";

export type BudgetItemException = {
  budgetItem: BudgetItem;
  reason: string;
};

export function findBudgetItemExceptions(budgetItems: BudgetItem[], assignments: Assignment[]): BudgetItemException[] {
  const exceptions: BudgetItemException[] = [];
  const stats = computeBudgetItemStats(budgetItems, assignments);

  for (const s of stats) {
    if (s.overCapacity) {
      exceptions.push({
        budgetItem: s.budgetItem,
        reason: `סך השיבוצים (${s.occupied}) חורג מהתקן המאושר (${s.budgetItem.allocatedQuota})`,
      });
    }
    for (const a of s.activeAssignments) {
      if (a.employmentPercent === null) {
        exceptions.push({ budgetItem: s.budgetItem, reason: "שיבוץ פעיל ללא אחוז משרה" });
      }
      if (!a.role) {
        exceptions.push({ budgetItem: s.budgetItem, reason: "שיבוץ פעיל ללא תפקיד מוגדר" });
      }
    }
  }

  return exceptions;
}

export type EmployeeException = {
  employee: Employee;
  reason: string;
};

export function findEmployeeExceptions(employees: Employee[]): EmployeeException[] {
  const exceptions: EmployeeException[] = [];
  const idCounts = new Map<string, number>();
  for (const e of employees) {
    if (e.idNumber) idCounts.set(e.idNumber, (idCounts.get(e.idNumber) ?? 0) + 1);
  }
  for (const e of employees) {
    if (e.idNumber && (idCounts.get(e.idNumber) ?? 0) > 1) {
      exceptions.push({ employee: e, reason: "מספר ת.ז. כפול" });
    }
  }
  return exceptions;
}
