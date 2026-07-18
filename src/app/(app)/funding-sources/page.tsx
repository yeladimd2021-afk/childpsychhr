"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useUnitsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeFundingSourceSummary, round2 } from "@/lib/domain/aggregation";
import { PositionsTable } from "@/components/positions/PositionsTable";

/** Pure financial summary, computed entirely from positions' own budgetComponents — no
 * creation flow of its own. */
export default function FundingSourcesPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: positions = [], isLoading } = usePositionsQuery();
  const { data: units = [] } = useUnitsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [expanded, setExpanded] = useState<string | null>(null);

  const summary = useMemo(() => computeFundingSourceSummary(positions, assignments), [positions, assignments]);

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-3 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">מקורות תקציב</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          מחושב מתוך רכיבי התקציב של כל התקנים — תצוגת סיכום בלבד
        </p>
      </div>

      <Card className="p-0">
        {summary.map((s, i) => {
          const isOpen = expanded === s.fundingSource;
          return (
            <div key={s.fundingSource} className={i > 0 ? "border-t border-border" : ""}>
              <button
                onClick={() => setExpanded(isOpen ? null : s.fundingSource)}
                className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-right"
              >
                <span className="w-24 shrink-0 font-medium">{s.fundingSource}</span>
                <Badge tone="blue">סה&quot;כ {round2(s.totalPercent * 100)}%</Badge>
                <Badge tone="green">מאויש {round2(s.occupiedPercent * 100)}%</Badge>
                <Badge tone="amber">פנוי {round2(s.vacantPercent * 100)}%</Badge>
                <span className="text-xs text-foreground-subtle">{s.positions.length} תקנים</span>
                <span className="text-xs text-foreground-subtle">{s.employeeCount} עובדים</span>
              </button>
              {isOpen && (
                <div className="border-t border-border bg-background/40 p-3">
                  <div className="overflow-hidden rounded-lg border border-border bg-surface">
                    <PositionsTable
                      positions={s.positions}
                      units={units}
                      employees={employees}
                      assignments={assignments}
                      editAllowed={editAllowed}
                      variant="compact"
                      emptyMessage="אין תקנים עם מקור תקציב זה"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {summary.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-subtle">
            עדיין אין רכיבי תקציב מוזנים בשום תקן
          </p>
        )}
      </Card>
    </div>
  );
}
