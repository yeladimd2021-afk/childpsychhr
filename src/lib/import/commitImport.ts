import { clearSeedSamples, createDoc } from "@/lib/data/dataClient";
import { recordHistoryEntry } from "@/lib/firebase/history";
import type { Unit } from "@/lib/schemas/unit";
import type { PositionFormValues } from "@/lib/schemas/position";
import type { EmployeeFormValues } from "@/lib/schemas/employee";
import type { AssignmentFormValues } from "@/lib/schemas/assignment";
import type { FutureChangeFormValues } from "@/lib/schemas/futureChange";
import type { ParsedPositionRow } from "./parsePositionsSheet";
import type { ParsedFutureChangeRow } from "./parseFutureChangesSheet";

export async function commitImportedPositions(params: {
  rows: ParsedPositionRow[];
  existingUnits: Unit[];
  userId: string;
  userName: string;
}): Promise<{ createdUnits: number; createdPositions: number; createdEmployees: number }> {
  const { rows, existingUnits, userId, userName } = params;

  clearSeedSamples();
  const unitIdByName = new Map<string, string>(
    existingUnits.filter((u) => !("seedSample" in u)).map((u) => [u.name, u.id])
  );
  let createdUnits = 0;

  const distinctUnitNames = [
    ...new Set(rows.map((r) => r.unitNameRaw).filter((v): v is string => !!v)),
  ];

  for (const name of distinctUnitNames) {
    if (unitIdByName.has(name)) continue;
    const now = Date.now();
    const id = await createDoc("units", { name, order: 0, createdAt: now, updatedAt: now });
    unitIdByName.set(name, id);
    createdUnits += 1;
  }

  let createdPositions = 0;
  let createdEmployees = 0;
  const now = Date.now();
  for (const row of rows) {
    const positionValues: PositionFormValues = {
      fundingSource: row.fundingSource,
      unitId: row.unitNameRaw ? (unitIdByName.get(row.unitNameRaw) ?? null) : null,
      budgetItemId: null,
      budgetItemRaw: row.budgetItemRaw,
      employmentPercent: row.employmentPercent,
      role: row.role,
      status: row.firstName
        ? row.employeeStatus === "פעיל" || row.employeeStatus === "עוזב"
          ? "מאויש"
          : "פנוי"
        : "פנוי",
      frozenUntil: null,
      source: "ייבוא",
      notes: row.notes ?? undefined,
    };
    const positionId = await createDoc("positions", { ...positionValues, createdAt: now, updatedAt: now });
    await recordHistoryEntry({
      entityType: "position",
      entityId: positionId,
      entityLabel: row.role ?? "תקן",
      action: "import",
      changes: [],
      changedBy: userId,
      changedByName: userName,
    });
    createdPositions += 1;

    if (row.firstName) {
      const employeeValues: EmployeeFormValues = {
        firstName: row.firstName,
        lastName: row.lastName ?? "",
        idNumber: row.idNumber,
        phone: null,
        actualUnitId: null,
        actualRole: null,
        source: "ייבוא",
        notes: undefined,
      };
      const employeeId = await createDoc("employees", { ...employeeValues, createdAt: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "employee",
        entityId: employeeId,
        entityLabel: `${row.firstName} ${row.lastName ?? ""}`.trim(),
        action: "import",
        changes: [],
        changedBy: userId,
        changedByName: userName,
      });
      createdEmployees += 1;

      const wasCurrentlyActive = row.employeeStatus === "פעיל" || row.employeeStatus === "עוזב";
      const assignmentValues: AssignmentFormValues = {
        employeeId,
        positionId,
        startDate: row.startDate,
        startDateText: row.startDateText,
        endDate: wasCurrentlyActive ? null : now,
        employmentPercent: row.employmentPercent,
        notes: row.notes ?? undefined,
      };
      const assignmentId = await createDoc("assignments", {
        ...assignmentValues,
        createdAt: now,
        updatedAt: now,
      });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: assignmentId,
        entityLabel: `${row.firstName} ${row.lastName ?? ""} → ${row.role ?? "תקן"}`,
        action: "import",
        changes: [],
        changedBy: userId,
        changedByName: userName,
      });
    }
  }

  return { createdUnits, createdPositions, createdEmployees };
}

export async function commitImportedFutureChanges(params: {
  rows: ParsedFutureChangeRow[];
  userId: string;
  userName: string;
}): Promise<{ createdFutureChanges: number }> {
  const { rows, userId, userName } = params;
  const now = Date.now();
  let createdFutureChanges = 0;

  for (const row of rows) {
    const values: FutureChangeFormValues = {
      firstName: row.firstName,
      lastName: row.lastName,
      employmentPercent: row.employmentPercent,
      effectiveDate: row.effectiveDate,
      effectiveDateText: row.effectiveDateText,
      fundingSource: row.fundingSource,
      positionRef: row.positionRef,
      changeType: row.changeType,
      status: "מתוכנן",
      relatedPositionId: null,
      notes: row.notes ?? undefined,
    };
    const id = await createDoc("futureChanges", { ...values, createdAt: now, updatedAt: now });
    await recordHistoryEntry({
      entityType: "futureChange",
      entityId: id,
      entityLabel: `${row.firstName} ${row.lastName}`,
      action: "import",
      changes: [],
      changedBy: userId,
      changedByName: userName,
    });
    createdFutureChanges += 1;
  }

  return { createdFutureChanges };
}
