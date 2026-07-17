import type { Position } from "@/lib/schemas/position";
import type { BudgetItem, Unit } from "@/lib/schemas/unit";
import type { Assignment } from "@/lib/schemas/assignment";
import { isActiveAssignment } from "@/lib/schemas/assignment";

export type UnitStats = {
  unit: Unit;
  allocatedQuota: number;
  occupied: number;
  vacant: number;
  /** False when the unit has no BudgetItem yet — allocatedQuota is "unset", not genuinely 0,
   * so vacant/occupied comparisons would be misleading until an admin fills in a real quota. */
  quotaDefined: boolean;
  staffCount: number;
  frozenCount: number;
};

export function computeUnitStats(
  units: Unit[],
  budgetItems: BudgetItem[],
  positions: Position[]
): UnitStats[] {
  // Occupied/vacant must roll up from the same per-budget-item numbers shown lower on this
  // page (computeBudgetItemStats), keyed by budgetItemId — not by position.unitId. A position's
  // own unit (where its holder physically works) can legitimately differ from the unit that
  // owns its budget line, so summing by position.unitId here would silently disagree with the
  // budget-item rows underneath it.
  const budgetItemStats = computeBudgetItemStats(budgetItems, positions);

  return units
    .map((unit) => {
      const unitBudgetItemStats = budgetItemStats.filter((s) => s.budgetItem.unitId === unit.id);
      const allocatedQuota = unitBudgetItemStats.reduce((sum, s) => sum + s.budgetItem.allocatedQuota, 0);
      const occupied = unitBudgetItemStats.reduce((sum, s) => sum + s.occupied, 0);
      // Headcount display (staffCount/frozenCount) is deliberately still based on physical
      // location (position.unitId) — a different concept from budget ownership above.
      const unitPositions = positions.filter((p) => p.unitId === unit.id);
      return {
        unit,
        allocatedQuota,
        occupied,
        vacant: allocatedQuota - occupied,
        quotaDefined: unitBudgetItemStats.length > 0,
        staffCount: unitPositions.length,
        frozenCount: unitPositions.filter((p) => p.status === "מוקפא").length,
      };
    })
    .sort((a, b) => a.unit.order - b.unit.order || a.unit.name.localeCompare(b.unit.name, "he"));
}

export type BudgetItemStats = {
  budgetItem: BudgetItem;
  occupied: number;
  vacant: number;
  assignedPositions: Position[];
};

export function computeBudgetItemStats(
  budgetItems: BudgetItem[],
  positions: Position[]
): BudgetItemStats[] {
  return budgetItems.map((budgetItem) => {
    const assignedPositions = positions.filter((p) => p.budgetItemId === budgetItem.id);
    const occupied = assignedPositions
      .filter((p) => p.status === "מאויש")
      .reduce((sum, p) => sum + (p.employmentPercent ?? 0), 0);
    return {
      budgetItem,
      occupied,
      vacant: budgetItem.allocatedQuota - occupied,
      assignedPositions,
    };
  });
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type PositionsSummary = {
  total: number;
  occupied: number;
  vacant: number;
  /** מאויש but the active assignment's own percent is smaller than the slot's — there's still
   * room on this exact position for another partial hire. */
  partiallyFilled: number;
  occupancyRate: number;
};

export function computePositionsSummary(positions: Position[], assignments: Assignment[]): PositionsSummary {
  const activeByPositionId = new Map<string, Assignment>();
  for (const a of assignments) {
    if (isActiveAssignment(a)) activeByPositionId.set(a.positionId, a);
  }

  let occupied = 0;
  let vacant = 0;
  let partiallyFilled = 0;
  for (const p of positions) {
    if (p.status === "מאויש") {
      occupied += 1;
      const assignment = activeByPositionId.get(p.id);
      if (
        assignment &&
        p.employmentPercent !== null &&
        assignment.employmentPercent !== null &&
        assignment.employmentPercent < p.employmentPercent
      ) {
        partiallyFilled += 1;
      }
    } else if (p.status === "פנוי") {
      vacant += 1;
    }
  }

  const total = positions.length;
  return {
    total,
    occupied,
    vacant,
    partiallyFilled,
    occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
  };
}

export type PositionVacancy = {
  /** The position's own slot size (employmentPercent), 0 when undefined. */
  total: number;
  /** The active assignment's percent, 0 when there's none. */
  filled: number;
  /** How much of the position's own slot is still unclaimed. */
  remaining: number;
};

export function computePositionVacancy(position: Position, assignment: Assignment | null): PositionVacancy {
  const total = position.employmentPercent ?? 0;
  const filled = assignment?.employmentPercent ?? 0;
  return { total, filled, remaining: Math.max(0, total - filled) };
}
