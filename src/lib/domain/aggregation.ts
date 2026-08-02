import type { FundingSource } from "@/lib/schemas/position";
import type { BudgetItem, Unit } from "@/lib/schemas/unit";
import type { Assignment } from "@/lib/schemas/assignment";
import { isActiveAssignment } from "@/lib/schemas/assignment";

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type BudgetItemStats = {
  budgetItem: BudgetItem;
  occupied: number;
  vacant: number;
  activeAssignments: Assignment[];
  /** Sum of active assignments' percent exceeds the approved quota. */
  overCapacity: boolean;
};

/** How much of a budget item's approved quota is actually claimed — derived directly from
 * Assignment records linked to it (`assignment.budgetItemId`), the one and only link between a
 * BudgetItem and who's assigned to it now that Position is no longer part of this flow. */
export function computeBudgetItemStats(budgetItems: BudgetItem[], assignments: Assignment[]): BudgetItemStats[] {
  return budgetItems.map((budgetItem) => {
    const activeAssignments = assignments.filter(
      (a) => a.budgetItemId === budgetItem.id && isActiveAssignment(a)
    );
    const occupied = activeAssignments.reduce((sum, a) => sum + (a.employmentPercent ?? 0), 0);
    return {
      budgetItem,
      occupied: round2(occupied),
      vacant: round2(budgetItem.allocatedQuota - occupied),
      activeAssignments,
      overCapacity: occupied - budgetItem.allocatedQuota > 0.005,
    };
  });
}

export type UnitStats = {
  unit: Unit;
  allocatedQuota: number;
  occupied: number;
  vacant: number;
  /** False when the unit has no BudgetItem yet — allocatedQuota is "unset", not genuinely 0. */
  quotaDefined: boolean;
  budgetItemCount: number;
};

export function computeUnitStats(units: Unit[], budgetItems: BudgetItem[], assignments: Assignment[]): UnitStats[] {
  const itemStats = computeBudgetItemStats(budgetItems, assignments);
  return units
    .map((unit) => {
      const unitItemStats = itemStats.filter((s) => s.budgetItem.unitId === unit.id);
      const allocatedQuota = unitItemStats.reduce((sum, s) => sum + s.budgetItem.allocatedQuota, 0);
      const occupied = unitItemStats.reduce((sum, s) => sum + s.occupied, 0);
      return {
        unit,
        allocatedQuota: round2(allocatedQuota),
        occupied: round2(occupied),
        vacant: round2(allocatedQuota - occupied),
        quotaDefined: unitItemStats.length > 0,
        budgetItemCount: unitItemStats.length,
      };
    })
    .sort((a, b) => a.unit.order - b.unit.order || a.unit.name.localeCompare(b.unit.name, "he"));
}

export type BudgetItemsSummary = {
  total: number;
  fullyOccupied: number;
  vacant: number;
  overCapacity: number;
  occupancyRate: number;
};

export function computeBudgetItemsSummary(budgetItems: BudgetItem[], assignments: Assignment[]): BudgetItemsSummary {
  const stats = computeBudgetItemStats(budgetItems, assignments);
  let fullyOccupied = 0;
  let vacant = 0;
  let overCapacity = 0;
  let totalQuota = 0;
  let totalOccupied = 0;
  for (const s of stats) {
    totalQuota += s.budgetItem.allocatedQuota;
    totalOccupied += s.occupied;
    if (s.overCapacity) overCapacity += 1;
    else if (s.vacant <= 0.005) fullyOccupied += 1;
    else if (s.occupied <= 0.005) vacant += 1;
  }
  return {
    total: budgetItems.length,
    fullyOccupied,
    vacant,
    overCapacity,
    occupancyRate: totalQuota > 0 ? Math.round((totalOccupied / totalQuota) * 100) : 0,
  };
}

export type FundingSourceSummary = {
  fundingSource: FundingSource;
  totalQuota: number;
  occupied: number;
  vacant: number;
  budgetItems: BudgetItem[];
  employeeCount: number;
};

/** Financial summary screen ("מקורות תקציב") — grouped by each budget item's own single
 * fundingSource field (unlike the old model, a budget item has exactly one funding source, so
 * there's no double-counting to worry about). */
export function computeFundingSourceSummary(
  budgetItems: BudgetItem[],
  assignments: Assignment[]
): FundingSourceSummary[] {
  const itemStats = computeBudgetItemStats(budgetItems, assignments);
  type Bucket = { totalQuota: number; occupied: number; items: BudgetItem[]; employeeIds: Set<string> };
  const bySource = new Map<FundingSource, Bucket>();

  for (const stat of itemStats) {
    const bucket = bySource.get(stat.budgetItem.fundingSource) ?? {
      totalQuota: 0,
      occupied: 0,
      items: [],
      employeeIds: new Set<string>(),
    };
    bucket.totalQuota += stat.budgetItem.allocatedQuota;
    bucket.occupied += stat.occupied;
    bucket.items.push(stat.budgetItem);
    for (const a of stat.activeAssignments) bucket.employeeIds.add(a.employeeId);
    bySource.set(stat.budgetItem.fundingSource, bucket);
  }

  return [...bySource.entries()]
    .map(([fundingSource, bucket]) => ({
      fundingSource,
      totalQuota: round2(bucket.totalQuota),
      occupied: round2(bucket.occupied),
      vacant: round2(bucket.totalQuota - bucket.occupied),
      budgetItems: bucket.items,
      employeeCount: bucket.employeeIds.size,
    }))
    .sort((a, b) => b.totalQuota - a.totalQuota);
}
