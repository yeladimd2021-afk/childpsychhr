"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { useUnitsQuery, useBudgetItemsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeFundingSourceSummary, computeBudgetItemStats, round2 } from "@/lib/domain/aggregation";
import { BudgetItemCard } from "@/components/budgetItems/BudgetItemCard";

/** Pure financial summary, computed entirely from each budget item's own single fundingSource
 * field — no creation flow of its own. */
export default function FundingSourcesPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [], isLoading } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [expanded, setExpanded] = useState<string | null>(null);

  const summary = useMemo(() => computeFundingSourceSummary(budgetItems, assignments), [budgetItems, assignments]);
  const allStats = useMemo(() => computeBudgetItemStats(budgetItems, assignments), [budgetItems, assignments]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const existingRoles = useMemo(
    () => [...new Set(assignments.map((a) => a.role).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, "he")),
    [assignments]
  );

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-3 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">מקורות תקציב</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          מחושב מתוך מקור התקציב של כל סעיף — תצוגת סיכום בלבד
        </p>
      </div>

      <Card className="p-0">
        {summary.map((s, i) => {
          const isOpen = expanded === s.fundingSource;
          const itemStats = allStats.filter((stat) => stat.budgetItem.fundingSource === s.fundingSource);
          return (
            <div key={s.fundingSource} className={i > 0 ? "border-t border-border" : ""}>
              <button
                onClick={() => setExpanded(isOpen ? null : s.fundingSource)}
                className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-right"
              >
                <span className="w-24 shrink-0 font-medium">{s.fundingSource}</span>
                <Badge tone="blue">סה&quot;כ {round2(s.totalQuota)}</Badge>
                <Badge tone="green">מאויש {round2(s.occupied)}</Badge>
                <Badge tone="amber">פנוי {round2(s.vacant)}</Badge>
                <span className="text-xs text-foreground-subtle">{s.budgetItems.length} סעיפי תקציב</span>
                <span className="text-xs text-foreground-subtle">{s.employeeCount} עובדים</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-border bg-background/40 p-3">
                  {itemStats.map((stat) => (
                    <BudgetItemCard
                      key={stat.budgetItem.id}
                      stats={stat}
                      unit={stat.budgetItem.unitId ? unitById.get(stat.budgetItem.unitId) : undefined}
                      units={units}
                      employees={employees}
                      editAllowed={editAllowed}
                      existingRoles={existingRoles}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {summary.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-subtle">עדיין אין סעיפי תקציב מוזנים</p>
        )}
      </Card>
    </div>
  );
}
