"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { useBudgetItemsQuery, useUnitsQuery } from "@/lib/queries/useUnits";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { UnitFormModal } from "@/components/units/UnitFormModal";
import type { Unit } from "@/lib/schemas/unit";

/** Plain CRUD for units (name/notes/order) — budget items and staffing now live entirely on
 * the "סעיפי תקציב ותקינה" screen, filterable by unit from there. */
export default function UnitsPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const unitStats = useMemo(() => computeUnitStats(units, budgetItems, assignments), [units, budgetItems, assignments]);

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
          const occupancyPct = s.quotaDefined && s.allocatedQuota > 0 ? Math.round((s.occupied / s.allocatedQuota) * 100) : null;
          return (
            <div key={s.unit.id} className={`flex items-center gap-2 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex flex-1 items-center gap-2">
                <span className="font-medium">{s.unit.name}</span>
                <span className="text-xs text-foreground-subtle">
                  · {s.budgetItemCount} סעיפי תקציב · מוקצה {s.quotaDefined ? round2(s.allocatedQuota) : "לא הוגדר"} · מאויש{" "}
                  {round2(s.occupied)}
                  {occupancyPct !== null && ` · ${occupancyPct}%`}
                </span>
              </div>
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
          );
        })}
        {unitStats.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-subtle">אין עדיין יחידות מוגדרות</p>
        )}
      </Card>

      {showCreateUnit && <UnitFormModal unit={null} onClose={() => setShowCreateUnit(false)} />}
      {editingUnit && <UnitFormModal unit={editingUnit} onClose={() => setEditingUnit(null)} />}
    </div>
  );
}
