"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useBudgetItemsQuery, useDeleteBudgetItemMutation, useUnitsQuery } from "@/lib/queries/useUnits";
import { useFutureChangesQuery } from "@/lib/queries/useFutureChanges";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { UnitFormModal } from "@/components/units/UnitFormModal";
import { BudgetItemFormModal } from "@/components/units/BudgetItemFormModal";
import { PositionsTable } from "@/components/positions/PositionsTable";
import type { Unit, BudgetItem } from "@/lib/schemas/unit";

export default function UnitsPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: positions = [] } = usePositionsQuery();
  const { data: futureChanges = [] } = useFutureChangesQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [addingBudgetItemFor, setAddingBudgetItemFor] = useState<string | null>(null);
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItem | null>(null);
  const deleteBudgetItemMutation = useDeleteBudgetItemMutation();

  function handleDeleteBudgetItem(b: BudgetItem) {
    const linkedPositions = positions.filter((p) => p.budgetItemId === b.id);
    if (linkedPositions.length > 0) {
      window.alert(
        `לא ניתן למחוק את "${b.label}" — ${linkedPositions.length} תקנים עדיין משויכים אליו. יש להעביר או למחוק אותם קודם.`
      );
      return;
    }
    const confirmed = window.confirm(
      `למחוק את סעיף התקציב "${b.label}" (${b.code})? פעולה זו סופית ואינה ניתנת לביטול.`
    );
    if (!confirmed) return;
    deleteBudgetItemMutation.mutate({ id: b.id, before: b });
  }

  const unitStats = useMemo(
    () => computeUnitStats(units, budgetItems, positions),
    [units, budgetItems, positions]
  );

  return (
    <div className="flex flex-col gap-3 p-6 md:p-8">
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

      <Card className="p-0">
        {unitStats.map((s, i) => {
          const isOpen = expandedUnit === s.unit.id;
          const unitBudgetItems = budgetItems.filter((b) => b.unitId === s.unit.id);
          const unitPositions = positions.filter((p) => p.unitId === s.unit.id);
          const upcoming = futureChanges.filter(
            (c) => c.status !== "בוצע" && unitPositions.some((p) => p.id === c.relatedPositionId)
          );
          const occupancyPct = s.quotaDefined && s.allocatedQuota > 0 ? Math.round((s.occupied / s.allocatedQuota) * 100) : null;

          return (
            <div key={s.unit.id} className={i > 0 ? "border-t border-border" : ""}>
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  onClick={() => setExpandedUnit(isOpen ? null : s.unit.id)}
                  className="flex flex-1 items-center gap-2 text-right"
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                  <span className="font-medium">{s.unit.name}</span>
                  <span className="text-xs text-foreground-subtle">
                    · מוקצה {s.quotaDefined ? round2(s.allocatedQuota) : "לא הוגדר"} · מאויש {round2(s.occupied)}
                    {occupancyPct !== null && ` · ${occupancyPct}%`}
                  </span>
                </button>
                {occupancyPct !== null && (
                  <Badge tone={occupancyPct >= 100 ? "green" : occupancyPct >= 70 ? "amber" : "red"}>
                    {occupancyPct}% איוש
                  </Badge>
                )}
                {editAllowed && (
                  <button
                    onClick={() => setEditingUnit(s.unit)}
                    aria-label="עריכת יחידה"
                    title="עריכת יחידה"
                    className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-border bg-background/40 px-4 py-4">
                  <div>
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
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2 py-1.5 text-xs hover:bg-brand-blue-soft"
                        >
                          <button
                            onClick={() => setEditingBudgetItem(b)}
                            className="flex flex-1 items-center justify-between text-right"
                          >
                            <span>
                              {b.label} ({b.code})
                            </span>
                            <span className="text-foreground-subtle">{round2(b.allocatedQuota)}</span>
                          </button>
                          {editAllowed && (
                            <button
                              onClick={() => handleDeleteBudgetItem(b)}
                              aria-label="מחיקת סעיף תקציב"
                              title="מחיקת סעיף תקציב"
                              className="shrink-0 rounded p-1 text-foreground-subtle hover:bg-brand-red-soft hover:text-brand-red"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {unitBudgetItems.length === 0 && (
                        <p className="text-xs text-foreground-subtle">אין עדיין סעיפי תקציב</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium text-foreground-subtle">תקנים ({unitPositions.length})</p>
                    <div className="overflow-hidden rounded-lg border border-border bg-surface">
                      <PositionsTable
                        positions={unitPositions}
                        units={units}
                        employees={employees}
                        assignments={assignments}
                        editAllowed={editAllowed}
                        variant="compact"
                        emptyMessage="אין עדיין תקנים ביחידה זו"
                      />
                    </div>
                  </div>

                  {upcoming.length > 0 && (
                    <div>
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
                    <p className="rounded-lg bg-brand-blue-soft px-3 py-2 text-xs text-brand-blue">{s.unit.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {unitStats.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-subtle">אין עדיין יחידות מוגדרות</p>
        )}
      </Card>

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
