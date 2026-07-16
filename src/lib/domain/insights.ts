import type { Position } from "@/lib/schemas/position";
import type { Unit, BudgetItem } from "@/lib/schemas/unit";
import type { AuditLogEntry } from "@/lib/schemas/auditLog";
import type { VacancyAgeTier } from "@/lib/domain/actionQueue";
import type { TrendPoint } from "@/lib/domain/trends";
import {
  buildStatusChangesByPosition,
  monthCutoffs,
  statusAtTime,
  type StatusChange,
} from "@/lib/domain/trends";

export type Insight = {
  id: string;
  tone: "positive" | "warning" | "neutral";
  message: string;
};

const STREAK_LOOKBACK_MONTHS = 12;
const STREAK_MIN_MONTHS_TO_MENTION = 3;

/** How many consecutive recent months (counting back from now) a unit has been at 100%+
 * occupancy — used to surface "unit X has been fully staffed for N months" style insights.
 * Only meaningful for units with a defined budget quota. */
function fullyStaffedStreakMonths(
  unit: Unit,
  positions: Position[],
  budgetItems: BudgetItem[],
  statusChangesByPosition: Map<string, StatusChange[]>,
  now: number
): number {
  // Positions counted toward a unit's quota are the ones budgeted under it — via budgetItemId —
  // not the ones physically stationed there via position.unitId, since those two can diverge.
  const unitBudgetItemIds = new Set(budgetItems.filter((b) => b.unitId === unit.id).map((b) => b.id));
  const unitPositions = positions.filter((p) => p.budgetItemId && unitBudgetItemIds.has(p.budgetItemId));
  const allocatedQuota = budgetItems.filter((b) => b.unitId === unit.id).reduce((s, b) => s + b.allocatedQuota, 0);
  if (allocatedQuota <= 0) return 0;

  const cutoffs = monthCutoffs(now, STREAK_LOOKBACK_MONTHS);
  let streak = 0;
  for (let i = cutoffs.length - 1; i >= 0; i--) {
    const ts = cutoffs[i].ts;
    let occupied = 0;
    for (const position of unitPositions) {
      const changes = statusChangesByPosition.get(position.id) ?? [];
      const statusAtT = statusAtTime(position, changes, ts);
      if (statusAtT === "מאויש") occupied += position.employmentPercent ?? 0;
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
  positions: Position[];
  budgetItems: BudgetItem[];
  auditEntriesAscending: AuditLogEntry[];
  vacancyAgeTiers: VacancyAgeTier[];
  trends: TrendPoint[];
  now?: number;
}): Insight[] {
  const { units, positions, budgetItems, auditEntriesAscending, vacancyAgeTiers, trends, now = Date.now() } = params;
  const insights: Insight[] = [];
  const statusChangesByPosition = buildStatusChangesByPosition(auditEntriesAscending);

  let bestUnit: { unit: Unit; months: number } | null = null;
  for (const unit of units) {
    const months = fullyStaffedStreakMonths(unit, positions, budgetItems, statusChangesByPosition, now);
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

  const staleByRole = new Map<string, number>();
  for (const tier of vacancyAgeTiers) {
    if (tier.severity !== "red" && tier.severity !== "orange") continue;
    const role = tier.position.role ?? "ללא תפקיד מוגדר";
    staleByRole.set(role, (staleByRole.get(role) ?? 0) + 1);
  }
  const topStaleRole = [...staleByRole.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topStaleRole && topStaleRole[1] >= 2) {
    insights.push({
      id: "stale-role",
      tone: "warning",
      message: `${topStaleRole[1]} תקנים פנויים בתפקיד "${topStaleRole[0]}" חורגים מהסף שהוגדר`,
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
