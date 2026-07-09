"use client";

import { useMemo } from "react";
import { Building2, Users, DoorOpen, Percent, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useUnitsQuery, useBudgetItemsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { computeUnitStats, round2 } from "@/lib/domain/aggregation";
import { exportVacancyReportToExcel } from "@/lib/export/exportVacancyReport";
import type { FundingSource } from "@/lib/schemas/position";

const FUNDING_SOURCES: FundingSource[] = ["מדינה", "קרן", "אחר"];
const FUNDING_BAR_CLASS: Record<FundingSource, string> = {
  מדינה: "bg-brand-blue",
  קרן: "bg-brand-turquoise",
  אחר: "bg-brand-green",
};
const FUNDING_DOT_CLASS: Record<FundingSource, string> = {
  מדינה: "bg-brand-blue",
  קרן: "bg-brand-turquoise",
  אחר: "bg-brand-green",
};

export default function ReportsPage() {
  const { data: positions = [], isLoading } = usePositionsQuery();
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: employees = [] } = useEmployeesQuery();

  const unitStats = useMemo(
    () => computeUnitStats(units, budgetItems, positions),
    [units, budgetItems, positions]
  );

  const totals = useMemo(() => {
    const withQuota = unitStats.filter((u) => u.quotaDefined);
    const allocatedQuota = withQuota.reduce((s, u) => s + u.allocatedQuota, 0);
    const occupied = unitStats.reduce((s, u) => s + u.occupied, 0);
    const vacant = withQuota.reduce((s, u) => s + u.vacant, 0);
    const occupancyRate = allocatedQuota > 0 ? (occupied / allocatedQuota) * 100 : 0;
    return { allocatedQuota, occupied, vacant, occupancyRate };
  }, [unitStats]);

  const fundingBreakdown = useMemo(() => {
    const total = positions.length || 1;
    return FUNDING_SOURCES.map((label) => {
      const count = positions.filter((p) => p.fundingSource === label).length;
      return { label, count, pct: round2((count / total) * 100) };
    });
  }, [positions]);

  const vacantPositions = useMemo(
    () => positions.filter((p) => p.status === "פנוי"),
    [positions]
  );
  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const budgetItemById = useMemo(() => new Map(budgetItems.map((b) => [b.id, b])), [budgetItems]);

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">דוחות</h1>
        <p className="mt-1 text-sm text-foreground-subtle">תמונת מצב מסכמת לכלל האגף</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="סך תקן מוקצה" value={round2(totals.allocatedQuota)} icon={Building2} tone="blue" />
        <KpiCard label="מאויש" value={round2(totals.occupied)} icon={Users} tone="turquoise" />
        <KpiCard label="פנוי" value={round2(totals.vacant)} icon={DoorOpen} tone="amber" />
        <KpiCard
          label="שיעור איוש"
          value={`${round2(totals.occupancyRate)}%`}
          icon={Percent}
          tone="green"
        />
      </div>

      <Card>
        <h2 className="mb-4 font-medium">איוש מול תקן מוקצה, לפי יחידה</h2>
        <div className="flex flex-col gap-3">
          {unitStats.map((s) => (
            <div key={s.unit.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm">{s.unit.name}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand-turquoise"
                  style={{
                    width: `${
                      s.allocatedQuota > 0 ? Math.min(100, (s.occupied / s.allocatedQuota) * 100) : 0
                    }%`,
                  }}
                />
              </div>
              <span className="w-32 shrink-0 text-left text-xs tabular-nums text-foreground-subtle">
                {round2(s.occupied)} / {s.quotaDefined ? round2(s.allocatedQuota) : "?"}
              </span>
            </div>
          ))}
          {unitStats.length === 0 && (
            <p className="text-sm text-foreground-subtle">אין עדיין יחידות מוגדרות במערכת.</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">תקנים לפי מקור תקציבי</h2>
        <div className="mb-4 flex flex-wrap gap-4">
          {FUNDING_SOURCES.map((label) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-foreground-subtle">
              <span className={`h-2.5 w-2.5 rounded-full ${FUNDING_DOT_CLASS[label]}`} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {fundingBreakdown.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm">{f.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full ${FUNDING_BAR_CLASS[f.label]}`}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-left text-xs tabular-nums text-foreground-subtle">
                {f.count} ({f.pct}%)
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">דוח תקנים פנויים</h2>
            <p className="mt-1 text-xs text-foreground-subtle">{vacantPositions.length} תקנים פנויים כרגע</p>
          </div>
          <button
            onClick={() => exportVacancyReportToExcel(vacantPositions, units)}
            disabled={vacantPositions.length === 0}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-60"
          >
            <Download size={16} />
            ייצוא לאקסל
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs text-foreground-subtle">
              <tr>
                <th className="px-3 py-3 text-right">תפקיד</th>
                <th className="px-3 py-3 text-right">יחידה</th>
                <th className="px-3 py-3 text-right">סעיף תקציב</th>
                <th className="px-3 py-3 text-right">מקור</th>
                <th className="px-3 py-3 text-right">%</th>
                <th className="px-3 py-3 text-right">הערות</th>
              </tr>
            </thead>
            <tbody>
              {vacantPositions.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">{p.role ?? "—"}</td>
                  <td className="px-3 py-3">{p.unitId ? (unitNameById.get(p.unitId) ?? "—") : "—"}</td>
                  <td className="px-3 py-3">
                    {p.budgetItemId ? (budgetItemById.get(p.budgetItemId)?.label ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-3">{p.fundingSource}</td>
                  <td className="px-3 py-3">
                    {p.employmentPercent !== null ? `${Math.round(p.employmentPercent * 100)}%` : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-foreground-subtle">
                    {p.notes || "—"}
                  </td>
                </tr>
              ))}
              {vacantPositions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-foreground-subtle">
                    אין כרגע תקנים פנויים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-medium">מצבת עובדים</h2>
        <p className="text-2xl font-semibold">{employees.length}</p>
        <p className="mt-1 text-xs text-foreground-subtle">סך העובדים הרשומים במערכת, משובצים ולא משובצים</p>
      </Card>
    </div>
  );
}
