import type { FundingSource, Position } from "@/lib/schemas/position";
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
  // "Occupied" is the physical positions filled in this unit (position.unitId) — a plain
  // headcount-vs-quota comparison. Now that a position's funding can be split across any number
  // of free-text budget components (no longer a single budgetItemId per position), there is no
  // reliable link left between a position and one specific BudgetItem to roll up through, so
  // routing occupancy via budget-item matching is no longer meaningful.
  return units
    .map((unit) => {
      const unitBudgetItems = budgetItems.filter((b) => b.unitId === unit.id);
      const allocatedQuota = unitBudgetItems.reduce((sum, b) => sum + b.allocatedQuota, 0);
      const unitPositions = positions.filter((p) => p.unitId === unit.id);
      const occupied = unitPositions
        .filter((p) => p.status === "מאויש")
        .reduce((sum, p) => sum + (p.employmentPercent ?? 0), 0);
      return {
        unit,
        allocatedQuota,
        occupied,
        vacant: allocatedQuota - occupied,
        quotaDefined: unitBudgetItems.length > 0,
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

export type FundingSourceSummary = {
  fundingSource: FundingSource;
  totalPercent: number;
  occupiedPercent: number;
  vacantPercent: number;
  positions: Position[];
  employeeCount: number;
};

/** Financial summary screen ("מקורות תקציב") — purely derived from positions' own
 * budgetComponents, grouped by funding-source category. A position contributes to every
 * category it has a component in, so its percent can appear under more than one source. */
export function computeFundingSourceSummary(
  positions: Position[],
  assignments: Assignment[]
): FundingSourceSummary[] {
  const activeByPositionId = new Map<string, Assignment>();
  for (const a of assignments) {
    if (isActiveAssignment(a)) activeByPositionId.set(a.positionId, a);
  }

  type Bucket = {
    totalPercent: number;
    occupiedPercent: number;
    vacantPercent: number;
    positionIds: Set<string>;
    employeeIds: Set<string>;
  };
  const bySource = new Map<FundingSource, Bucket>();

  for (const p of positions) {
    for (const component of p.budgetComponents ?? []) {
      const bucket = bySource.get(component.fundingSource) ?? {
        totalPercent: 0,
        occupiedPercent: 0,
        vacantPercent: 0,
        positionIds: new Set<string>(),
        employeeIds: new Set<string>(),
      };
      bucket.totalPercent += component.percent;
      if (p.status === "מאויש") bucket.occupiedPercent += component.percent;
      else if (p.status === "פנוי") bucket.vacantPercent += component.percent;
      bucket.positionIds.add(p.id);
      const assignment = activeByPositionId.get(p.id);
      if (assignment) bucket.employeeIds.add(assignment.employeeId);
      bySource.set(component.fundingSource, bucket);
    }
  }

  return [...bySource.entries()]
    .map(([fundingSource, bucket]) => ({
      fundingSource,
      totalPercent: round2(bucket.totalPercent),
      occupiedPercent: round2(bucket.occupiedPercent),
      vacantPercent: round2(bucket.vacantPercent),
      positions: positions.filter((p) => bucket.positionIds.has(p.id)),
      employeeCount: bucket.employeeIds.size,
    }))
    .sort((a, b) => b.totalPercent - a.totalPercent);
}
