"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useUnitsQuery, useBudgetItemsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { useAllAuditLogQuery } from "@/lib/queries/useAuditLog";
import { computePositionVacancy, round2 } from "@/lib/domain/aggregation";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { isActiveAssignment } from "@/lib/schemas/assignment";

/** A filtered view of the same positions data shown in "ניהול תקנים" — no independent
 * creation flow here; positions are only ever created from the main screen. */
export default function VacanciesPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: positions = [], isLoading } = usePositionsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();
  const { data: auditEntriesAscending = [] } = useAllAuditLogQuery();

  const [unitFilter, setUnitFilter] = useState("");

  const activeAssignmentByPositionId = useMemo(() => {
    const map = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.positionId, a);
    }
    return map;
  }, [assignments]);

  const vacantOrPartial = useMemo(() => {
    let result = positions.filter((p) => {
      if (p.status === "פנוי") return true;
      if (p.status !== "מאויש") return false;
      const vacancy = computePositionVacancy(p, activeAssignmentByPositionId.get(p.id) ?? null);
      return vacancy.remaining > 0.001;
    });
    if (unitFilter) result = result.filter((p) => p.unitId === unitFilter);
    return result;
  }, [positions, activeAssignmentByPositionId, unitFilter]);

  const totalRemaining = useMemo(
    () =>
      round2(
        vacantOrPartial.reduce(
          (sum, p) => sum + computePositionVacancy(p, activeAssignmentByPositionId.get(p.id) ?? null).remaining,
          0
        )
      ),
    [vacantOrPartial, activeAssignmentByPositionId]
  );

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">תקנים פנויים</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          {vacantOrPartial.length} תקנים פנויים או מאוישים חלקית · יתרה כוללת: {totalRemaining}
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">כל היחידות</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {unitFilter && (
            <button
              type="button"
              onClick={() => setUnitFilter("")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-brand-blue hover:underline"
            >
              נקה סינון
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <PositionsTable
          positions={vacantOrPartial}
          units={units}
          budgetItems={budgetItems}
          employees={employees}
          assignments={assignments}
          editAllowed={editAllowed}
          variant="vacant"
          auditEntriesAscending={auditEntriesAscending}
          emptyMessage="אין כרגע תקנים פנויים או מאוישים חלקית"
        />
      </Card>
    </div>
  );
}
