"use client";

import { useMemo } from "react";
import { Users, DoorOpen, Building2, AlertTriangle, UserPlus, UserMinus } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useUnitsQuery, useBudgetItemsQuery } from "@/lib/queries/useUnits";
import { useFutureChangesQuery } from "@/lib/queries/useFutureChanges";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { findEmployeeExceptions, findPositionExceptions } from "@/lib/domain/exceptions";

const FUNDING_LABELS = ["מדינה", "קרן", "אחר"] as const;

export default function DashboardPage() {
  const { data: positions = [], isLoading: loadingPositions } = usePositionsQuery();
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: futureChanges = [] } = useFutureChangesQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const unitStats = useMemo(
    () => computeUnitStats(units, budgetItems, positions),
    [units, budgetItems, positions]
  );

  const totals = useMemo(() => {
    const withQuota = unitStats.filter((u) => u.quotaDefined);
    const allocatedQuota = withQuota.reduce((s, u) => s + u.allocatedQuota, 0);
    const occupied = unitStats.reduce((s, u) => s + u.occupied, 0);
    const vacant = withQuota.reduce((s, u) => s + u.vacant, 0);
    const unitsMissingQuota = unitStats.length - withQuota.length;
    return { allocatedQuota, occupied, vacant, unitsMissingQuota };
  }, [unitStats]);

  const fundingBreakdown = useMemo(() => {
    return FUNDING_LABELS.map((label) => ({
      label,
      count: positions.filter((p) => p.fundingSource === label).length,
    }));
  }, [positions]);

  const positionExceptions = useMemo(
    () => findPositionExceptions(positions, assignments),
    [positions, assignments]
  );
  const employeeExceptions = useMemo(() => findEmployeeExceptions(employees), [employees]);
  const exceptionCount = positionExceptions.length + employeeExceptions.length;

  const dataSourceLabel = useMemo(() => {
    if (positions.length === 0) return "אין נתונים עדיין";
    const hasImport = positions.some((p) => p.source === "ייבוא");
    const hasManual = positions.some((p) => p.source === "ידני");
    if (hasImport && hasManual) return "משולב — הזנה ידנית + ייבוא מאקסל";
    if (hasImport) return "ייבוא מאקסל";
    return "הזנה ידנית";
  }, [positions]);

  const joining = futureChanges.filter((c) => c.changeType === "קליטה" && c.status !== "בוצע");
  const leaving = futureChanges.filter((c) => c.changeType === "עזיבה" && c.status !== "בוצע");

  const upcomingByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of futureChanges) {
      if (!c.effectiveDate) continue;
      const d = new Date(c.effectiveDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [futureChanges]);

  if (loadingPositions) {
    return <div className="p-8 text-sm text-foreground-subtle">טוען נתונים...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">לוח מחוונים קלאסי</h1>
          <p className="mt-1 text-sm text-foreground-subtle">תמונת מצב מלאה של תקני האגף</p>
        </div>
        <Badge tone="blue">מקור הנתונים: {dataSourceLabel}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="סך כל התקנים"
          value={round2(totals.allocatedQuota)}
          icon={Building2}
          tone="blue"
          subtitle={
            totals.unitsMissingQuota > 0
              ? `${totals.unitsMissingQuota} יחידות ללא תקן מוקצה מוגדר`
              : undefined
          }
        />
        <KpiCard
          label="תקנים מאוישים"
          value={round2(totals.occupied)}
          icon={Users}
          tone="turquoise"
        />
        <KpiCard
          label="תקנים פנויים"
          value={round2(totals.vacant)}
          icon={DoorOpen}
          tone={totals.vacant > 0 ? "amber" : "green"}
          subtitle="מבין היחידות עם תקן מוקצה מוגדר בלבד"
        />
        <KpiCard
          label="חריגות לטיפול"
          value={exceptionCount}
          icon={AlertTriangle}
          tone={exceptionCount > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-medium">תקנים פנויים לפי יחידה</h2>
          <div className="flex flex-col gap-3">
            {unitStats.map((s) => (
              <div key={s.unit.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm">{s.unit.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-brand-turquoise"
                    style={{
                      width: `${
                        s.allocatedQuota > 0
                          ? Math.min(100, (s.occupied / s.allocatedQuota) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="w-28 shrink-0 text-left text-xs text-foreground-subtle">
                  {round2(s.occupied)} / {s.quotaDefined ? round2(s.allocatedQuota) : "?"}
                </span>
                {!s.quotaDefined ? (
                  <Badge tone="neutral">אין תקן מוקצה מוגדר</Badge>
                ) : (
                  <Badge tone={s.vacant > 0.01 ? "amber" : "green"}>
                    {s.vacant > 0.01 ? `פנוי ${round2(s.vacant)}` : "מאויש במלואו"}
                  </Badge>
                )}
              </div>
            ))}
            {unitStats.length === 0 && (
              <p className="text-sm text-foreground-subtle">אין עדיין יחידות מוגדרות במערכת.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">תקנים לפי מקור תקציבי</h2>
          <div className="flex flex-col gap-3">
            {fundingBreakdown.map((f) => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-sm">{f.label}</span>
                <Badge tone="blue">{f.count} תקנים</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <UserPlus size={18} className="text-brand-green" />
            עובדים בתהליך קליטה
          </h2>
          <p className="mb-2 text-2xl font-semibold">{joining.length}</p>
          <ul className="flex flex-col gap-1 text-sm text-foreground-subtle">
            {joining.slice(0, 5).map((c) => (
              <li key={c.id}>
                {c.firstName} {c.lastName}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <UserMinus size={18} className="text-brand-red" />
            עובדים שעוזבים בקרוב
          </h2>
          <p className="mb-2 text-2xl font-semibold">{leaving.length}</p>
          <ul className="flex flex-col gap-1 text-sm text-foreground-subtle">
            {leaving.slice(0, 5).map((c) => (
              <li key={c.id}>
                {c.firstName} {c.lastName}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">שינויים עתידיים לפי חודש</h2>
          <div className="flex flex-col gap-2">
            {upcomingByMonth.map(([month, count]) => (
              <div key={month} className="flex items-center justify-between text-sm">
                <span>{month}</span>
                <Badge tone="blue">{count}</Badge>
              </div>
            ))}
            {upcomingByMonth.length === 0 && (
              <p className="text-sm text-foreground-subtle">אין שינויים עתידיים עם תאריך.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} className="text-brand-red" />
          חריגות ובעיות לטיפול
        </h2>
        {exceptionCount === 0 ? (
          <p className="text-sm text-foreground-subtle">לא נמצאו חריגות — הכל תקין.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {positionExceptions.slice(0, 20).map((e, i) => (
              <div
                key={`p-${i}`}
                className="flex items-center justify-between rounded-lg bg-brand-red-soft px-3 py-2 text-sm"
              >
                <span>{e.position.role ?? "תקן"}</span>
                <span className="text-brand-red">{e.reason}</span>
              </div>
            ))}
            {employeeExceptions.slice(0, 20).map((e, i) => (
              <div
                key={`e-${i}`}
                className="flex items-center justify-between rounded-lg bg-brand-red-soft px-3 py-2 text-sm"
              >
                <span>
                  {e.employee.firstName} {e.employee.lastName}
                </span>
                <span className="text-brand-red">{e.reason}</span>
              </div>
            ))}
            {exceptionCount > 20 && (
              <p className="text-xs text-foreground-subtle">
                ועוד {exceptionCount - 20} חריגות נוספות — ראה/י מסך עובדים ותקנים
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
