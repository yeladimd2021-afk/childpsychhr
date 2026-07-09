"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useBudgetItemsQuery, useUnitsQuery } from "@/lib/queries/useUnits";
import { useFutureChangesQuery } from "@/lib/queries/useFutureChanges";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { UnitFormModal } from "@/components/units/UnitFormModal";
import { BudgetItemFormModal } from "@/components/units/BudgetItemFormModal";
import type { Unit, BudgetItem } from "@/lib/schemas/unit";
import { formatEmployeeName } from "@/lib/schemas/employee";
import { isActiveAssignment } from "@/lib/schemas/assignment";

export default function UnitsPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: positions = [] } = usePositionsQuery();
  const { data: futureChanges = [] } = useFutureChangesQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [addingBudgetItemFor, setAddingBudgetItemFor] = useState<string | null>(null);
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItem | null>(null);

  const unitStats = useMemo(
    () => computeUnitStats(units, budgetItems, positions),
    [units, budgetItems, positions]
  );
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const activeAssignmentByPositionId = useMemo(() => {
    const map = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.positionId, a);
    }
    return map;
  }, [assignments]);

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">יחידות ומחלקות</h1>
          <p className="mt-1 text-sm text-foreground-subtle">{units.length} יחידות</p>
        </div>
        {editAllowed && (
          <button
            onClick={() => setShowCreateUnit(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            <Plus size={16} />
            הוספת יחידה
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {unitStats.map((s) => {
          const staff = positions.filter((p) => p.unitId === s.unit.id);
          const unitBudgetItems = budgetItems.filter((b) => b.unitId === s.unit.id);
          const upcoming = futureChanges.filter(
            (c) => c.status !== "בוצע" && staff.some((p) => p.id === c.relatedPositionId)
          );

          return (
            <Card key={s.unit.id}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-medium">{s.unit.name}</p>
                  <p className="text-xs text-foreground-subtle">
                    מוקצה {s.quotaDefined ? round2(s.allocatedQuota) : "לא הוגדר"} · מאויש{" "}
                    {round2(s.occupied)}
                    {s.quotaDefined && ` · יתרה ${round2(s.vacant)}`}
                  </p>
                </div>
                {editAllowed && (
                  <button
                    onClick={() => setEditingUnit(s.unit)}
                    aria-label="עריכת יחידה"
                    className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>

              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground-subtle">סעיפי תקציב</p>
                  {editAllowed && (
                    <button
                      onClick={() => setAddingBudgetItemFor(s.unit.id)}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      + הוספת סעיף
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {unitBudgetItems.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setEditingBudgetItem(b)}
                      className="flex items-center justify-between rounded-lg bg-background px-2 py-1.5 text-xs hover:bg-brand-blue-soft"
                    >
                      <span>
                        {b.label} ({b.code})
                      </span>
                      <span className="text-foreground-subtle">{round2(b.allocatedQuota)}</span>
                    </button>
                  ))}
                  {unitBudgetItems.length === 0 && (
                    <p className="text-xs text-foreground-subtle">אין עדיין סעיפי תקציב</p>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-foreground-subtle">
                  תקנים ({staff.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {staff.slice(0, 8).map((p) => {
                    const assignment = activeAssignmentByPositionId.get(p.id);
                    const employee = assignment ? employeeById.get(assignment.employeeId) : null;
                    return (
                      <Badge key={p.id} tone={p.status === "מאויש" ? "green" : "amber"}>
                        {employee ? formatEmployeeName(employee) : (p.role ?? "תקן פנוי")}
                      </Badge>
                    );
                  })}
                  {staff.length > 8 && <Badge tone="neutral">+{staff.length - 8}</Badge>}
                </div>
              </div>

              {upcoming.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-foreground-subtle">שינויים צפויים</p>
                  <div className="flex flex-col gap-1 text-xs text-foreground-subtle">
                    {upcoming.map((c) => (
                      <p key={c.id}>
                        {c.firstName} {c.lastName} — {c.changeType}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {s.unit.notes && (
                <p className="rounded-lg bg-brand-blue-soft px-3 py-2 text-xs text-brand-blue">
                  {s.unit.notes}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {showCreateUnit && <UnitFormModal unit={null} onClose={() => setShowCreateUnit(false)} />}
      {editingUnit && <UnitFormModal unit={editingUnit} onClose={() => setEditingUnit(null)} />}
      {addingBudgetItemFor && (
        <BudgetItemFormModal
          unitId={addingBudgetItemFor}
          budgetItem={null}
          onClose={() => setAddingBudgetItemFor(null)}
        />
      )}
      {editingBudgetItem && (
        <BudgetItemFormModal
          unitId={editingBudgetItem.unitId}
          budgetItem={editingBudgetItem}
          onClose={() => setEditingBudgetItem(null)}
        />
      )}
    </div>
  );
}
