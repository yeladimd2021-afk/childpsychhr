import type { Position } from "@/lib/schemas/position";
import type { BudgetItem, Unit } from "@/lib/schemas/unit";

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
