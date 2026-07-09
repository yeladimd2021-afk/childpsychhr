"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ListChecks,
  CalendarClock,
  AlertOctagon,
  Gauge,
  Zap,
  History as HistoryIcon,
  Lightbulb,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Percent,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useUnitsQuery, useBudgetItemsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { useFutureChangesQuery } from "@/lib/queries/useFutureChanges";
import { useVacancyReviewsQuery } from "@/lib/queries/useVacancyReviews";
import { useSystemSettingsQuery } from "@/lib/queries/useSystemSettings";
import { useAllAuditLogQuery, useAuditLogQuery } from "@/lib/queries/useAuditLog";
import { computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { findEmployeeExceptions, findPositionExceptions } from "@/lib/domain/exceptions";
import {
  computeActionQueue,
  computeVacancyAgeTiers,
  type ActionSeverity,
} from "@/lib/domain/actionQueue";
import { computeCriticalAlerts } from "@/lib/domain/criticalAlerts";
import { computeTrends } from "@/lib/domain/trends";
import { computeInsights } from "@/lib/domain/insights";
import type { FutureChange } from "@/lib/schemas/futureChange";

const SEVERITY_DOT: Record<ActionSeverity, string> = {
  red: "bg-brand-red",
  orange: "bg-brand-amber",
  yellow: "bg-brand-amber",
  blue: "bg-brand-blue",
};

const CHANGE_ICON: Record<FutureChange["changeType"], React.ComponentType<{ size?: number; className?: string }>> = {
  קליטה: UserPlus,
  עזיבה: UserMinus,
  "מעבר תקן": ArrowRightLeft,
  "שינוי אחוזי משרה": Percent,
};
const CHANGE_ICON_TONE: Record<FutureChange["changeType"], string> = {
  קליטה: "text-brand-green",
  עזיבה: "text-brand-red",
  "מעבר תקן": "text-brand-blue",
  "שינוי אחוזי משרה": "text-brand-turquoise",
};

type TimelineTier = "critical" | "urgent" | "planning" | "undated";
const TIMELINE_TIER_TONE: Record<TimelineTier, "red" | "amber" | "blue" | "neutral"> = {
  critical: "red",
  urgent: "amber",
  planning: "blue",
  undated: "neutral",
};
const TIMELINE_TIER_LABEL: Record<TimelineTier, string> = {
  critical: "קריטי",
  urgent: "דחוף",
  planning: "מתוכנן",
  undated: "ללא תאריך",
};

export default function ControlCenterPage() {
  const router = useRouter();
  const [staffingRequestNotice, setStaffingRequestNotice] = useState(false);
  // Date.now() is impure — read once into state on mount (client-only) rather than calling it
  // directly during render, matching this app's existing pattern (see AuthContext) for
  // deferring anything time/localStorage-dependent until after the initial render.
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);

  const { data: positions = [], isLoading: loadingPositions } = usePositionsQuery();
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();
  const { data: futureChanges = [] } = useFutureChangesQuery();
  const { data: vacancyReviews = [] } = useVacancyReviewsQuery();
  const { data: settings, isLoading: loadingSettings } = useSystemSettingsQuery();
  const { data: auditEntriesAscending = [] } = useAllAuditLogQuery();
  const { data: recentAuditEntries = [] } = useAuditLogQuery();

  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);

  const unitStats = useMemo(
    () => computeUnitStats(units, budgetItems, positions),
    [units, budgetItems, positions]
  );
  const totals = useMemo(() => {
    const withQuota = unitStats.filter((u) => u.quotaDefined);
    const allocatedQuota = withQuota.reduce((s, u) => s + u.allocatedQuota, 0);
    const occupied = unitStats.reduce((s, u) => s + u.occupied, 0);
    const occupancyRate = allocatedQuota > 0 ? (occupied / allocatedQuota) * 100 : 0;
    return { allocatedQuota, occupied, occupancyRate };
  }, [unitStats]);

  const positionExceptions = useMemo(
    () => findPositionExceptions(positions, assignments),
    [positions, assignments]
  );
  const employeeExceptions = useMemo(() => findEmployeeExceptions(employees), [employees]);

  const vacancyAgeTiers = useMemo(
    () =>
      settings && now !== null
        ? computeVacancyAgeTiers(positions, auditEntriesAscending, settings.vacancyThresholds, now)
        : [],
    [positions, auditEntriesAscending, settings, now]
  );

  const actionQueue = useMemo(
    () =>
      settings && now !== null
        ? computeActionQueue({
            positions,
            employees,
            futureChanges,
            vacancyReviews,
            positionExceptions,
            employeeExceptions,
            vacancyAgeTiers,
            settings,
            now,
          })
        : [],
    [
      settings,
      now,
      positions,
      employees,
      futureChanges,
      vacancyReviews,
      positionExceptions,
      employeeExceptions,
      vacancyAgeTiers,
    ]
  );

  const criticalAlerts = useMemo(
    () =>
      computeCriticalAlerts({
        positions,
        positionExceptions,
        employeeExceptions,
        vacancyAgeTiers,
        unitNameById,
      }),
    [positions, positionExceptions, employeeExceptions, vacancyAgeTiers, unitNameById]
  );

  const trends = useMemo(
    () =>
      now !== null
        ? computeTrends({ positions, employees, budgetItems, auditEntriesAscending, now })
        : [],
    [positions, employees, budgetItems, auditEntriesAscending, now]
  );

  const insights = useMemo(
    () =>
      now !== null
        ? computeInsights({ units, positions, budgetItems, auditEntriesAscending, vacancyAgeTiers, trends, now })
        : [],
    [units, positions, budgetItems, auditEntriesAscending, vacancyAgeTiers, trends, now]
  );

  const headcountDelta = useMemo(() => {
    if (trends.length < 2) return null;
    return trends[trends.length - 1].headcount - trends[trends.length - 2].headcount;
  }, [trends]);

  const timeline = useMemo(() => {
    if (!settings || now === null) return [];
    const DAY = 24 * 60 * 60 * 1000;
    const relevant = futureChanges.filter((c) => c.status !== "בוצע");
    return relevant
      .map((c) => {
        const daysUntil = c.effectiveDate ? Math.ceil((c.effectiveDate - now) / DAY) : null;
        let tier: TimelineTier = "undated";
        if (daysUntil !== null) {
          if (daysUntil <= settings.leavingWindows.criticalDays) tier = "critical";
          else if (daysUntil <= settings.leavingWindows.urgentDays) tier = "urgent";
          else tier = "planning";
        }
        return { change: c, daysUntil, tier };
      })
      .filter((t) => t.daysUntil === null || t.daysUntil <= settings.leavingWindows.planningDays)
      .sort((a, b) => {
        if (a.daysUntil === null) return 1;
        if (b.daysUntil === null) return -1;
        return a.daysUntil - b.daysUntil;
      });
  }, [futureChanges, settings, now]);

  const recentlyCompleted = useMemo(() => {
    return recentAuditEntries
      .filter(
        (e) =>
          e.entityType === "assignment" ||
          (e.entityType === "position" && e.changes.some((c) => c.field === "status")) ||
          (e.entityType === "futureChange" && e.changes.some((c) => c.field === "status" && c.newValue === "בוצע"))
      )
      .slice(0, 6);
  }, [recentAuditEntries]);

  const isLoading = loadingPositions || loadingSettings;
  if (isLoading || !settings || now === null) {
    return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">מרכז שליטה ניהולי</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          מה דורש את תשומת ליבך היום · עודכן {new Date(now).toLocaleString("he-IL")}
        </p>
      </div>

      {/* 1. Action Queue */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <ListChecks size={18} className="text-brand-blue" />
          משימות הדורשות טיפול
        </h2>
        {actionQueue.length === 0 ? (
          <p className="text-sm text-foreground-subtle">אין כרגע משימות פתוחות — הכל מטופל.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {actionQueue.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-background"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                <span className="flex-1">{item.title}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* 2. Workforce Timeline */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <CalendarClock size={18} className="text-brand-turquoise" />
          תנועת כוח אדם — 90 הימים הקרובים
        </h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-foreground-subtle">אין שינויי כוח אדם מתוכננים בטווח זה.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {timeline.slice(0, 10).map(({ change, daysUntil, tier }) => {
              const Icon = CHANGE_ICON[change.changeType];
              return (
                <div
                  key={change.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} className={CHANGE_ICON_TONE[change.changeType]} />
                    <span className="font-medium">
                      {change.firstName} {change.lastName}
                    </span>
                    <span className="text-foreground-subtle">{change.changeType}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-foreground-subtle">
                      {daysUntil !== null
                        ? daysUntil >= 0
                          ? `בעוד ${daysUntil} ימים`
                          : `באיחור של ${Math.abs(daysUntil)} ימים`
                        : "ללא תאריך"}
                    </span>
                    <Badge tone={TIMELINE_TIER_TONE[tier]}>{TIMELINE_TIER_LABEL[tier]}</Badge>
                  </span>
                </div>
              );
            })}
            {timeline.length > 10 && (
              <Link href="/changes" className="text-xs font-medium text-brand-blue hover:underline">
                עוד {timeline.length - 10} שינויים — למסך המלא ↗
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* 3. Critical Alerts */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <AlertOctagon size={18} className="text-brand-red" />
          התראות קריטיות
        </h2>
        {criticalAlerts.length === 0 ? (
          <p className="text-sm text-foreground-subtle">אין כרגע התראות קריטיות.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {criticalAlerts.slice(0, 8).map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-red-soft px-3 py-2 text-sm hover:brightness-95"
              >
                <span className="text-brand-red">{alert.message}</span>
                <Badge tone="red">{alert.category}</Badge>
              </Link>
            ))}
            {criticalAlerts.length > 8 && (
              <p className="text-xs text-foreground-subtle">
                ועוד {criticalAlerts.length - 8} התראות — ראה/י לוח מחוונים קלאסי
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 4. Executive KPIs */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-medium">
          <Gauge size={18} className="text-brand-blue" />
          מדדי ליבה
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="שיעור איוש" value={`${round2(totals.occupancyRate)}%`} tone="turquoise" />
          <KpiCard label="שיעור פנויות" value={`${round2(100 - totals.occupancyRate)}%`} tone="amber" />
          <KpiCard
            label="מצבת עובדים"
            value={employees.length}
            tone="blue"
            subtitle={
              headcountDelta !== null && headcountDelta !== 0
                ? `${headcountDelta > 0 ? "+" : ""}${headcountDelta} מהחודש הקודם`
                : undefined
            }
          />
          <KpiCard
            label="חריגות ותקנים פנויים קריטיים"
            value={criticalAlerts.length}
            tone={criticalAlerts.length > 0 ? "red" : "green"}
          />
        </div>
      </div>

      {/* 5. Quick Actions */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <Zap size={18} className="text-brand-amber" />
          פעולות מהירות
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push("/positions?tab=employees&new=employee")}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            <Plus size={16} />
            הוספת עובד
          </button>
          <button
            onClick={() => router.push("/positions?new=position")}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            <Plus size={16} />
            הוספת תקן
          </button>
          <button
            onClick={() => router.push("/positions?statusFilter=פנוי")}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            <UserPlus size={16} />
            שיבוץ עובד
          </button>
          <button
            onClick={() => router.push("/changes?new=1")}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            <Plus size={16} />
            רישום שינוי ארגוני
          </button>
          <button
            onClick={() => setStaffingRequestNotice(true)}
            title="בקרוב"
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium text-foreground-subtle hover:bg-background"
          >
            <Plus size={16} />
            פתיחת בקשת תקינה
          </button>
        </div>
        {staffingRequestNotice && (
          <p className="mt-3 rounded-lg bg-brand-blue-soft px-3 py-2 text-xs text-brand-blue">
            מודול &quot;בקשות תקינה&quot; נמצא בתכנון ויתווסף בשלב הבא של המערכת.
          </p>
        )}
      </Card>

      {/* 6. Recently Completed */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <HistoryIcon size={18} className="text-foreground-subtle" />
          פעולות שהושלמו לאחרונה
        </h2>
        {recentlyCompleted.length === 0 ? (
          <p className="text-sm text-foreground-subtle">אין עדיין פעולות רשומות.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentlyCompleted.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span>{entry.entityLabel}</span>
                <span className="text-xs text-foreground-subtle">
                  {new Date(entry.changedAt).toLocaleString("he-IL")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 7. Smart Insights */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <Lightbulb size={18} className="text-brand-amber" />
          תובנות
        </h2>
        {insights.length === 0 ? (
          <p className="text-sm text-foreground-subtle">אין תובנות חדשות כרגע.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {insights.map((insight) => (
              <p
                key={insight.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  insight.tone === "positive"
                    ? "bg-brand-green-soft text-brand-green"
                    : insight.tone === "warning"
                      ? "bg-brand-amber-soft text-brand-amber"
                      : "bg-brand-blue-soft text-brand-blue"
                }`}
              >
                {insight.message}
              </p>
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-foreground-subtle">
        דוחות מלאים, ייצוא וטבלאות מפורטות — במסך &quot;דוחות&quot;
      </p>
    </div>
  );
}
