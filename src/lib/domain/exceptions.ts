import type { Position } from "@/lib/schemas/position";
import type { Employee } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";
import { isActiveAssignment } from "@/lib/schemas/assignment";

export type PositionException = {
  position: Position;
  reason: string;
};

export function findPositionExceptions(
  positions: Position[],
  assignments: Assignment[]
): PositionException[] {
  const exceptions: PositionException[] = [];
  const activeAssignmentByPositionId = new Map<string, Assignment>();
  for (const a of assignments) {
    if (isActiveAssignment(a)) activeAssignmentByPositionId.set(a.positionId, a);
  }

  for (const p of positions) {
    const hasActiveAssignment = activeAssignmentByPositionId.has(p.id);
    if (p.status === "מאויש" && !hasActiveAssignment) {
      exceptions.push({ position: p, reason: 'תקן מסומן "מאויש" ללא שיבוץ עובד פעיל' });
    }
    if (p.status !== "מאויש" && hasActiveAssignment) {
      exceptions.push({ position: p, reason: "תקן עם שיבוץ פעיל אך לא מסומן כמאויש" });
    }
    if (p.status === "מאויש" && p.employmentPercent === null) {
      exceptions.push({ position: p, reason: "תקן מאויש ללא אחוזי משרה" });
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
