import type { Employee } from "@/lib/schemas/employee";
import type { BudgetItem } from "@/lib/schemas/unit";
import type { Assignment } from "@/lib/schemas/assignment";

export type TrendPoint = {
  monthKey: string;
  monthLabel: string;
  ts: number;
  occupancyRate: number;
  vacantCount: number;
  headcount: number;
};

const HEBREW_MONTHS = [
  "ינו",
  "פבר",
  "מרץ",
  "אפר",
  "מאי",
  "יונ",
  "יול",
  "אוג",
  "ספט",
  "אוק",
  "נוב",
  "דצמ",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date) {
  return `${HEBREW_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/** The last moment of each of the last `months` months, with the very last entry being "now"
 * (the current month is still in progress, so its point reflects the live state rather than a
 * hypothetical future month-end). */
export function monthCutoffs(now: number, months: number) {
  const nowDate = new Date(now);
  const cutoffs: { key: string; label: string; ts: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    if (i === 0) {
      cutoffs.push({ key: monthKey(nowDate), label: monthLabel(nowDate), ts: now });
    } else {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i + 1, 0, 23, 59, 59, 999);
      cutoffs.push({ key: monthKey(d), label: monthLabel(d), ts: d.getTime() });
    }
  }
  return cutoffs;
}

/** Was this assignment covering its budget item at time T — computed directly from its own
 * start/end dates, no audit trail needed (unlike the old Position-status-history approach). */
export function isAssignmentActiveAt(a: Assignment, t: number): boolean {
  if (a.startDate !== null && a.startDate > t) return false;
  return a.endDate === null || a.endDate > t;
}

export function computeTrends(params: {
  budgetItems: BudgetItem[];
  assignments: Assignment[];
  employees: Employee[];
  months?: number;
  now?: number;
}): TrendPoint[] {
  const { budgetItems, assignments, employees, months = 6, now = Date.now() } = params;

  const totalAllocatedQuota = budgetItems.reduce((sum, b) => sum + b.allocatedQuota, 0);
  const cutoffs = monthCutoffs(now, months);

  return cutoffs.map(({ key, label, ts }) => {
    let occupied = 0;
    let vacantCount = 0;
    for (const budgetItem of budgetItems) {
      if (budgetItem.createdAt > ts) continue;
      const occupiedAtT = assignments
        .filter((a) => a.budgetItemId === budgetItem.id && isAssignmentActiveAt(a, ts))
        .reduce((sum, a) => sum + (a.employmentPercent ?? 0), 0);
      occupied += occupiedAtT;
      if (occupiedAtT < budgetItem.allocatedQuota - 0.005) vacantCount += 1;
    }
    const headcount = employees.filter((e) => e.createdAt <= ts).length;
    return {
      monthKey: key,
      monthLabel: label,
      ts,
      occupancyRate: totalAllocatedQuota > 0 ? Math.round((occupied / totalAllocatedQuota) * 1000) / 10 : 0,
      vacantCount,
      headcount,
    };
  });
}
