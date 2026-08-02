import type { Unit, BudgetItem } from "@/lib/schemas/unit";
import type { Assignment } from "@/lib/schemas/assignment";
import type { VacancyAgeTier } from "@/lib/domain/actionQueue";
import type { TrendPoint } from "@/lib/domain/trends";
import { monthCutoffs, isAssignmentActiveAt } from "@/lib/domain/trends";

export type Insight = {
  id: string;
  tone: "positive" | "warning" | "neutral";
  message: string;
};

const STREAK_LOOKBACK_MONTHS = 12;
const STREAK_MIN_MONTHS_TO_MENTION = 3;

/** How many consecutive recent months (counting back from now) a unit has been at 100%+
 * occupancy across its budget items — computed directly from assignment start/end date ranges
 * (no audit trail needed, unlike the old Position-status-history approach). */
function fullyStaffedStreakMonths(
  unit: Unit,
  budgetItems: BudgetItem[],
  assignments: Assignment[],
  now: number
): number {
  const unitBudgetItems = budgetItems.filter((b) => b.unitId === unit.id);
  const allocatedQuota = unitBudgetItems.reduce((s, b) => s + b.allocatedQuota, 0);
  if (allocatedQuota <= 0) return 0;

  const cutoffs = monthCutoffs(now, STREAK_LOOKBACK_MONTHS);
  let streak = 0;
  for (let i = cutoffs.length - 1; i >= 0; i--) {
    const ts = cutoffs[i].ts;
    let occupied = 0;
    for (const budgetItem of unitBudgetItems) {
      if (budgetItem.createdAt > ts) continue;
      occupied += assignments
        .filter((a) => a.budgetItemId === budgetItem.id && isAssignmentActiveAt(a, ts))
        .reduce((sum, a) => sum + (a.employmentPercent ?? 0), 0);
    }
    if (occupied >= allocatedQuota) streak += 1;
    else break;
  }
  return streak;
}

/** Deterministic, rule-based natural-language summaries — computed from the same data as the
 * action queue and trends, not an LLM call. Kept explainable: every sentence traces back to a
 * concrete calculation, so it never says something the underlying numbers don't support. */
export function computeInsights(params: {
  units: Unit[];
  budgetItems: BudgetItem[];
  assignments: Assignment[];
  vacancyAgeTiers: VacancyAgeTier[];
  trends: TrendPoint[];
  now?: number;
}): Insight[] {
  const { units, budgetItems, assignments, vacancyAgeTiers, trends, now = Date.now() } = params;
  const insights: Insight[] = [];

  let bestUnit: { unit: Unit; months: number } | null = null;
  for (const unit of units) {
    const months = fullyStaffedStreakMonths(unit, budgetItems, assignments, now);
    if (months >= STREAK_MIN_MONTHS_TO_MENTION && (!bestUnit || months > bestUnit.months)) {
      bestUnit = { unit, months };
    }
  }
  if (bestUnit) {
    insights.push({
      id: "fully-staffed-streak",
      tone: "positive",
      message: `${bestUnit.unit.name} מאוישת במלואה כבר ${bestUnit.months} חודשים`,
    });
  }

  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const staleByUnit = new Map<string, number>();
  for (const tier of vacancyAgeTiers) {
    if (tier.severity !== "red" && tier.severity !== "orange") continue;
    const unitName = tier.budgetItem.unitId ? (unitNameById.get(tier.budgetItem.unitId) ?? "לא ידועה") : "ללא יחידה";
    staleByUnit.set(unitName, (staleByUnit.get(unitName) ?? 0) + 1);
  }
  const topStaleUnit = [...staleByUnit.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topStaleUnit && topStaleUnit[1] >= 2) {
    insights.push({
      id: "stale-unit",
      tone: "warning",
      message: `${topStaleUnit[1]} סעיפי תקציב עם יתרה פנויה ביחידה "${topStaleUnit[0]}" חורגים מהסף שהוגדר`,
    });
  }

  if (trends.length >= 2) {
    const last = trends[trends.length - 1];
    const prev = trends[trends.length - 2];
    const delta = Math.round((last.occupancyRate - prev.occupancyRate) * 10) / 10;
    if (Math.abs(delta) >= 1) {
      insights.push({
        id: "occupancy-delta",
        tone: delta > 0 ? "positive" : "warning",
        message:
          delta > 0
            ? `שיעור האיוש השתפר ב-${delta}% לעומת החודש הקודם`
            : `שיעור האיוש ירד ב-${Math.abs(delta)}% לעומת החודש הקודם`,
      });
    }
  }

  return insights;
}
