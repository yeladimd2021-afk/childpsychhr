"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useBudgetItemsQuery, useUnitsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { useSetVacancyReviewMutation, useVacancyReviewsQuery } from "@/lib/queries/useVacancyReviews";
import { computeBudgetItemStats, computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { PositionFormModal } from "@/components/positions/PositionFormModal";
import { formatEmployeeName } from "@/lib/schemas/employee";
import { isActiveAssignment } from "@/lib/schemas/assignment";
import type { VacancyReviewStatusValue } from "@/lib/schemas/vacancyReview";

const STATUS_OPTIONS: VacancyReviewStatusValue[] = ["לבדיקה", "בתהליך", "אושר", "הסתיים"];
const STATUS_TONE: Record<VacancyReviewStatusValue, "amber" | "blue" | "green" | "neutral"> = {
  לבדיקה: "amber",
  בתהליך: "blue",
  אושר: "green",
  הסתיים: "neutral",
};

export default function VacanciesPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: positions = [], isLoading } = usePositionsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();
  const { data: reviews = [] } = useVacancyReviewsQuery();
  const setReview = useSetVacancyReviewMutation();

  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const activeAssignmentByPositionId = useMemo(() => {
    const map = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.positionId, a);
    }
    return map;
  }, [assignments]);

  const unitStats = useMemo(
    () => computeUnitStats(units, budgetItems, positions).filter((s) => s.allocatedQuota > 0 || s.staffCount > 0),
    [units, budgetItems, positions]
  );
  const budgetItemStats = useMemo(
    () => computeBudgetItemStats(budgetItems, positions),
    [budgetItems, positions]
  );
  const reviewByBudgetItemId = useMemo(
    () => new Map(reviews.map((r) => [r.budgetItemId, r])),
    [reviews]
  );

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">תקנים פנויים</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            מחושב אוטומטית מתוך יחידות, סעיפי תקציב ורשומות התקנים
          </p>
        </div>
        {editAllowed && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            <Plus size={18} />
            הוסף תקן פנוי
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {unitStats.map((s) => {
          const unitBudgetItems = budgetItemStats.filter((b) => b.budgetItem.unitId === s.unit.id);
          const isOpen = expandedUnit === s.unit.id;
          return (
            <Card key={s.unit.id}>
              <button
                onClick={() => setExpandedUnit(isOpen ? null : s.unit.id)}
                className="flex w-full items-center justify-between text-right"
              >
                <div>
                  <p className="font-medium">{s.unit.name}</p>
                  <p className="text-xs text-foreground-subtle">
                    מוקצה {s.quotaDefined ? round2(s.allocatedQuota) : "לא הוגדר"} · מאויש{" "}
                    {round2(s.occupied)}
                  </p>
                </div>
                {!s.quotaDefined ? (
                  <Badge tone="neutral">אין תקן מוקצה מוגדר</Badge>
                ) : (
                  <Badge tone={s.vacant > 0.01 ? "amber" : "green"}>
                    {s.vacant > 0.01 ? `פנוי ${round2(s.vacant)}` : "מאויש במלואו"}
                  </Badge>
                )}
              </button>

              {isOpen && (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                  {unitBudgetItems.length === 0 && (
                    <p className="text-sm text-foreground-subtle">
                      אין סעיפי תקציב מוגדרים ליחידה זו עדיין — ניתן להוסיף במסך יחידות ומחלקות.
                    </p>
                  )}
                  {unitBudgetItems.map((b) => {
                    const review = reviewByBudgetItemId.get(b.budgetItem.id);
                    const staffNames = b.assignedPositions
                      .map((p) => {
                        const assignment = activeAssignmentByPositionId.get(p.id);
                        const employee = assignment ? employeeById.get(assignment.employeeId) : null;
                        return employee ? formatEmployeeName(employee) : null;
                      })
                      .filter((name): name is string => !!name);
                    return (
                      <div
                        key={b.budgetItem.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{b.budgetItem.label}</p>
                          <p className="text-xs text-foreground-subtle">
                            קוד {b.budgetItem.code} · מוקצה {round2(b.budgetItem.allocatedQuota)} ·
                            מאויש {round2(b.occupied)} · פנוי {round2(b.vacant)}
                          </p>
                          {staffNames.length > 0 && (
                            <p className="mt-1 text-xs text-foreground-subtle">
                              כוח אדם: {staffNames.join(", ")}
                            </p>
                          )}
                        </div>
                        <select
                          disabled={!editAllowed}
                          value={review?.status ?? "לבדיקה"}
                          onChange={(e) =>
                            setReview.mutate({
                              budgetItemId: b.budgetItem.id,
                              status: e.target.value as VacancyReviewStatusValue,
                            })
                          }
                          className="rounded-lg border border-border px-2 py-1 text-xs"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <Badge tone={STATUS_TONE[review?.status ?? "לבדיקה"]}>
                          {review?.status ?? "לבדיקה"}
                        </Badge>
                      </div>
                    );
                  })}

                  <div className="rounded-lg bg-brand-blue-soft px-3 py-2 text-xs text-brand-blue">
                    {s.staffCount} תקנים ביחידה, מתוכם {s.frozenCount} במעמד &quot;מוקפא&quot;
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {unitStats.length === 0 && (
          <p className="text-sm text-foreground-subtle">
            אין עדיין נתונים — הוסיפו יחידות ותקנים כדי לראות כאן תמונת מצב.
          </p>
        )}
      </div>

      {showCreateModal && (
        <PositionFormModal
          position={null}
          units={units}
          budgetItems={budgetItems}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
