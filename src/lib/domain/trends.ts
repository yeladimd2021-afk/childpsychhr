import type { Position, PositionStatus } from "@/lib/schemas/position";
import type { Employee } from "@/lib/schemas/employee";
import type { BudgetItem } from "@/lib/schemas/unit";
import type { AuditLogEntry } from "@/lib/schemas/auditLog";

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

export type StatusChange = { changedAt: number; oldValue: PositionStatus };

export function buildStatusChangesByPosition(
  auditEntriesAscending: AuditLogEntry[]
): Map<string, StatusChange[]> {
  const map = new Map<string, StatusChange[]>();
  for (const entry of auditEntriesAscending) {
    if (entry.entityType !== "position") continue;
    for (const change of entry.changes) {
      if (change.field !== "status") continue;
      const list = map.get(entry.entityId) ?? [];
      list.push({ changedAt: entry.changedAt, oldValue: change.oldValue as PositionStatus });
      map.set(entry.entityId, list);
    }
  }
  return map;
}

/** Reconstructs what a position's status was at time T by walking forward from its current
 * (known) status and un-applying any status changes that happened after T. Approximation, not
 * a full replay: employmentPercent and budget quotas are treated as constant at their current
 * value throughout the window, since slot-size/budget edits are rare compared to status flips
 * and replaying those too would need a much larger audit-log surface than exists today. */
export function statusAtTime(
  position: Position,
  changesAscending: StatusChange[],
  t: number
): PositionStatus | null {
  if (position.createdAt > t) return null;
  const firstAfter = changesAscending.find((c) => c.changedAt > t);
  return firstAfter ? firstAfter.oldValue : position.status;
}

export function computeTrends(params: {
  positions: Position[];
  employees: Employee[];
  budgetItems: BudgetItem[];
  auditEntriesAscending: AuditLogEntry[];
  months?: number;
  now?: number;
}): TrendPoint[] {
  const { positions, employees, budgetItems, auditEntriesAscending, months = 6, now = Date.now() } = params;

  const statusChangesByPosition = buildStatusChangesByPosition(auditEntriesAscending);
  const totalAllocatedQuota = budgetItems.reduce((sum, b) => sum + b.allocatedQuota, 0);
  const cutoffs = monthCutoffs(now, months);

  return cutoffs.map(({ key, label, ts }) => {
    let occupied = 0;
    let vacantCount = 0;
    for (const position of positions) {
      const changes = statusChangesByPosition.get(position.id) ?? [];
      const statusAtT = statusAtTime(position, changes, ts);
      if (statusAtT === null) continue;
      if (statusAtT === "מאויש") occupied += position.employmentPercent ?? 0;
      if (statusAtT === "פנוי") vacantCount += 1;
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
