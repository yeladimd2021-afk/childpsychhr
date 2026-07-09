import type { Position } from "@/lib/schemas/position";
import type { Employee } from "@/lib/schemas/employee";
import type { FutureChange } from "@/lib/schemas/futureChange";
import type { VacancyReview } from "@/lib/schemas/vacancyReview";
import type { AuditLogEntry } from "@/lib/schemas/auditLog";
import type { SystemSettings } from "@/lib/schemas/systemSettings";
import type { PositionException, EmployeeException } from "@/lib/domain/exceptions";

export type ActionSeverity = "red" | "orange" | "yellow" | "blue";

export type ActionItem = {
  id: string;
  severity: ActionSeverity;
  title: string;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The last time a position flipped to פנוי, per the audit trail — falls back to its
 * creation time if it has been vacant since it was created (no recorded status change). */
export function getVacantSince(position: Position, auditEntriesAscending: AuditLogEntry[]): number {
  let latest = position.createdAt;
  for (const entry of auditEntriesAscending) {
    if (entry.entityType !== "position" || entry.entityId !== position.id) continue;
    for (const change of entry.changes) {
      if (change.field === "status" && change.newValue === "פנוי") {
        latest = entry.changedAt;
      }
    }
  }
  return latest;
}

export type VacancyAgeTier = {
  position: Position;
  daysVacant: number;
  severity: ActionSeverity;
};

/** Buckets every currently-vacant position by how long it's been vacant, per the configurable
 * thresholds in SystemSettings — this is the one calculation both the action queue and the
 * critical-alerts section key off of, so they always agree with each other. */
export function computeVacancyAgeTiers(
  positions: Position[],
  auditEntriesAscending: AuditLogEntry[],
  thresholds: SystemSettings["vacancyThresholds"],
  now: number = Date.now()
): VacancyAgeTier[] {
  return positions
    .filter((p) => p.status === "פנוי")
    .map((position) => {
      const vacantSince = getVacantSince(position, auditEntriesAscending);
      const daysVacant = Math.floor((now - vacantSince) / DAY_MS);
      let severity: ActionSeverity = "blue";
      if (daysVacant >= thresholds.redDays) severity = "red";
      else if (daysVacant >= thresholds.orangeDays) severity = "orange";
      else if (daysVacant >= thresholds.yellowDays) severity = "yellow";
      return { position, daysVacant, severity };
    })
    .sort((a, b) => b.daysVacant - a.daysVacant);
}

const SEVERITY_LABEL: Record<Exclude<ActionSeverity, "blue">, string> = {
  red: "קריטי",
  orange: "עדיפות גבוהה",
  yellow: "דורש תשומת לב",
};

export function computeActionQueue(params: {
  positions: Position[];
  employees: Employee[];
  futureChanges: FutureChange[];
  vacancyReviews: VacancyReview[];
  positionExceptions: PositionException[];
  employeeExceptions: EmployeeException[];
  vacancyAgeTiers: VacancyAgeTier[];
  settings: SystemSettings;
  now?: number;
}): ActionItem[] {
  const {
    futureChanges,
    vacancyReviews,
    positionExceptions,
    employeeExceptions,
    vacancyAgeTiers,
    settings,
    now = Date.now(),
  } = params;

  const items: ActionItem[] = [];

  const exceptionCount = positionExceptions.length + employeeExceptions.length;
  if (exceptionCount > 0) {
    items.push({
      id: "exceptions",
      severity: "red",
      title: `${exceptionCount} חריגות נתונים ממתינות לבדיקה`,
      href: "/dashboard",
    });
  }

  (["red", "orange", "yellow"] as const).forEach((severity) => {
    const count = vacancyAgeTiers.filter((t) => t.severity === severity).length;
    if (count > 0) {
      items.push({
        id: `vacancy-${severity}`,
        severity,
        title: `${count} תקנים פנויים — ${SEVERITY_LABEL[severity]}`,
        href: "/reports",
      });
    }
  });

  const leavingSoon = futureChanges.filter((c) => c.changeType === "עזיבה" && c.status !== "בוצע");
  const daysUntil = (c: FutureChange) => (c.effectiveDate ? (c.effectiveDate - now) / DAY_MS : Infinity);
  const criticalLeaving = leavingSoon.filter((c) => daysUntil(c) <= settings.leavingWindows.criticalDays);
  const urgentLeaving = leavingSoon.filter(
    (c) => daysUntil(c) > settings.leavingWindows.criticalDays && daysUntil(c) <= settings.leavingWindows.urgentDays
  );
  if (criticalLeaving.length > 0) {
    items.push({
      id: "leaving-critical",
      severity: "red",
      title: `${criticalLeaving.length} עובדים עוזבים תוך ${settings.leavingWindows.criticalDays} ימים`,
      href: "/changes",
    });
  }
  if (urgentLeaving.length > 0) {
    items.push({
      id: "leaving-urgent",
      severity: "orange",
      title: `${urgentLeaving.length} עובדים עוזבים תוך ${settings.leavingWindows.urgentDays} ימים`,
      href: "/changes",
    });
  }

  const staleReviews = vacancyReviews.filter(
    (r) =>
      (r.status === "לבדיקה" || r.status === "בתהליך") &&
      (now - r.updatedAt) / DAY_MS >= settings.leavingWindows.urgentDays
  );
  if (staleReviews.length > 0) {
    items.push({
      id: "stale-reviews",
      severity: "yellow",
      title: `${staleReviews.length} סעיפי תקציב בבדיקה מעל ${settings.leavingWindows.urgentDays} ימים`,
      href: "/vacancies",
    });
  }

  const severityOrder: Record<ActionSeverity, number> = { red: 0, orange: 1, yellow: 2, blue: 3 };
  return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
