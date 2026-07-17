"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Download, History as HistoryIcon, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useBudgetItemsQuery, useUnitsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { PositionFormModal } from "@/components/positions/PositionFormModal";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { HistoryModal } from "@/components/shared/HistoryModal";
import { exportPositionsToExcel } from "@/lib/export/exportPositionsToExcel";
import { computePositionsSummary } from "@/lib/domain/aggregation";
import type { Position } from "@/lib/schemas/position";
import type { Employee } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import { isActiveAssignment, type Assignment } from "@/lib/schemas/assignment";

const PAGE_SIZE = 25;

type Tab = "positions" | "employees";

export default function PositionsPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: positions = [], isLoading: loadingPositions } = usePositionsQuery();
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [tab, setTab] = useState<Tab>("positions");
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fundingFilter, setFundingFilter] = useState("");
  const [employeeUnitFilter, setEmployeeUnitFilter] = useState("");
  const [page, setPage] = useState(1);

  const [showCreatePosition, setShowCreatePosition] = useState(false);
  const [historyEntity, setHistoryEntity] = useState<{ id: string; label: string } | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const newParam = searchParams.get("new");
    const statusFilterParam = searchParams.get("statusFilter");
    const searchParam = searchParams.get("search");
    // One-time sync from the URL a quick action arrived with (Control Center) into local
    // state — not a response to external state changing over time, so the usual "don't
    // setState in an effect" guidance doesn't really fit this one-shot deep-link case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tabParam === "employees" || tabParam === "positions") setTab(tabParam);
    if (statusFilterParam) setStatusFilter(statusFilterParam);
    if (searchParam) setSearch(searchParam);
    if (newParam === "employee") setShowCreateEmployee(true);
    if (newParam === "position") setShowCreatePosition(true);
    if (tabParam || newParam || statusFilterParam || searchParam) router.replace("/positions");
    // Only meant to run once, reading whatever query params the Control Center's quick
    // actions arrived with — not meant to react to later changes in searchParams/router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const positionById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const roleOptions = useMemo(
    () => [...new Set(positions.map((p) => p.role).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, "he")),
    [positions]
  );

  const activeAssignmentByPositionId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.positionId, a);
    }
    return map;
  }, [assignments]);

  // An employee can hold more than one active assignment at once (e.g. a social worker split
  // across a residential unit and a clinic, each its own budget line) — keyed to a list, not a
  // single Assignment, so no simultaneous position silently disappears from view.
  const activeAssignmentsByEmployeeId = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!isActiveAssignment(a)) continue;
      const list = map.get(a.employeeId) ?? [];
      list.push(a);
      map.set(a.employeeId, list);
    }
    return map;
  }, [assignments]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const summary = useMemo(() => computePositionsSummary(positions, assignments), [positions, assignments]);

  const filteredPositions = useMemo(() => {
    let result = positions;
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((p) => {
        const assignment = activeAssignmentByPositionId.get(p.id);
        const employee = assignment ? employeeById.get(assignment.employeeId) : null;
        const unitName = p.unitId ? (unitNameById.get(p.unitId) ?? "") : "";
        return (
          (p.role ?? "").includes(q) ||
          unitName.includes(q) ||
          (p.notes ?? "").includes(q) ||
          (employee ? formatEmployeeName(employee).includes(q) : false)
        );
      });
    }
    if (unitFilter) result = result.filter((p) => p.unitId === unitFilter);
    if (roleFilter) result = result.filter((p) => p.role === roleFilter);
    if (statusFilter) result = result.filter((p) => p.status === statusFilter);
    if (fundingFilter) result = result.filter((p) => p.fundingSource === fundingFilter);
    return result;
  }, [
    positions,
    search,
    unitFilter,
    roleFilter,
    statusFilter,
    fundingFilter,
    activeAssignmentByPositionId,
    employeeById,
    unitNameById,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredPositions.length / PAGE_SIZE));
  // Clamped instead of reset via an effect — filtering down to fewer pages while sitting on a
  // later page snaps back to the last valid one automatically, without a setState-in-effect.
  const safePage = Math.min(page, totalPages);
  const pagedPositions = filteredPositions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((e) => formatEmployeeName(e).includes(q) || (e.idNumber ?? "").includes(q));
    }
    if (employeeUnitFilter) {
      result = result.filter((e) => {
        const employeeAssignments = activeAssignmentsByEmployeeId.get(e.id) ?? [];
        return employeeAssignments.some(
          (a) => positionById.get(a.positionId)?.unitId === employeeUnitFilter
        );
      });
    }
    return result;
  }, [employees, search, employeeUnitFilter, activeAssignmentsByEmployeeId, positionById]);

  if (loadingPositions || loadingEmployees) {
    return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ניהול תקנים</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            {positions.length} תקנים · {employees.length} עובדים
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportPositionsToExcel(positions, units, employees, activeAssignmentByPositionId)}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            <Download size={16} />
            ייצוא לאקסל
          </button>
          {editAllowed && tab === "positions" && (
            <button
              onClick={() => setShowCreatePosition(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              <Plus size={18} />
              הוסף תקן
            </button>
          )}
          {editAllowed && tab === "employees" && (
            <button
              onClick={() => setShowCreateEmployee(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              <Plus size={18} />
              הוסף עובד
            </button>
          )}
        </div>
      </div>

      {tab === "positions" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">סה&quot;כ תקנים</p>
            <p className="mt-1 text-xl font-semibold">{summary.total}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">מאוישים</p>
            <p className="mt-1 text-xl font-semibold text-brand-green">{summary.occupied}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">פנויים</p>
            <p className="mt-1 text-xl font-semibold text-brand-amber">{summary.vacant}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">מאוישים חלקית</p>
            <p className="mt-1 text-xl font-semibold text-brand-blue">{summary.partiallyFilled}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">אחוז איוש</p>
            <p className="mt-1 text-xl font-semibold">{summary.occupancyRate}%</p>
          </Card>
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("positions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "positions" ? "border-brand-blue text-brand-blue" : "border-transparent text-foreground-subtle"
          }`}
        >
          תקנים
        </button>
        <button
          onClick={() => setTab("employees")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "employees" ? "border-brand-blue text-brand-blue" : "border-transparent text-foreground-subtle"
          }`}
        >
          עובדים
        </button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <input
            placeholder={tab === "positions" ? "חיפוש לפי תפקיד או שם עובד" : "חיפוש לפי שם או ת.ז."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          {tab === "positions" && (
            <>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">כל היחידות</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">כל התפקידים</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">כל הסטטוסים</option>
                <option value="מאויש">מאויש</option>
                <option value="פנוי">פנוי</option>
                <option value="מוקפא">מוקפא</option>
                <option value="בביטול">בביטול</option>
              </select>
              <select
                value={fundingFilter}
                onChange={(e) => setFundingFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">כל המקורות התקציביים</option>
                <option value="מדינה">מדינה</option>
                <option value="קרן">קרן</option>
                <option value="אחר">אחר</option>
              </select>
              {(unitFilter || roleFilter || statusFilter || fundingFilter || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setUnitFilter("");
                    setRoleFilter("");
                    setStatusFilter("");
                    setFundingFilter("");
                    setSearch("");
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-blue hover:underline"
                >
                  נקה סינון
                </button>
              )}
            </>
          )}
          {tab === "employees" && (
            <>
              <select
                value={employeeUnitFilter}
                onChange={(e) => setEmployeeUnitFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">כל היחידות</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {(employeeUnitFilter || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeUnitFilter("");
                    setSearch("");
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-blue hover:underline"
                >
                  נקה סינון
                </button>
              )}
            </>
          )}
        </div>
      </Card>

      {tab === "positions" ? (
        <>
          <Card className="overflow-x-auto p-0">
            <PositionsTable
              positions={pagedPositions}
              units={units}
              budgetItems={budgetItems}
              employees={employees}
              assignments={assignments}
              editAllowed={editAllowed}
              variant="full"
            />
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              >
                הקודם
              </button>
              <span className="text-foreground-subtle">
                עמוד {safePage} מתוך {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              >
                הבא
              </button>
            </div>
          )}
        </>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs text-foreground-subtle">
              <tr>
                <th className="px-3 py-3 text-right">שם מלא</th>
                <th className="px-3 py-3 text-right">ת.ז.</th>
                <th className="px-3 py-3 text-right">טלפון</th>
                <th className="px-3 py-3 text-right">תקן נוכחי</th>
                <th className="px-3 py-3 text-right">יחידה (תקציבית)</th>
                <th className="px-3 py-3 text-right">מחלקה בפועל</th>
                <th className="px-3 py-3 text-right">תפקיד בפועל</th>
                <th className="px-3 py-3 text-right">הערות</th>
                <th className="px-3 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const employeeAssignments = activeAssignmentsByEmployeeId.get(emp.id) ?? [];
                const employeePositions = employeeAssignments
                  .map((a) => positionById.get(a.positionId))
                  .filter((p): p is Position => !!p);
                return (
                  <tr key={emp.id} className="border-t border-border hover:bg-background/60">
                    <td className="px-3 py-3 font-medium">{formatEmployeeName(emp)}</td>
                    <td dir="ltr" className="px-3 py-3 text-left text-foreground-subtle">
                      {emp.idNumber ?? "—"}
                    </td>
                    <td dir="ltr" className="px-3 py-3 text-left text-foreground-subtle">
                      {emp.phone ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {employeePositions.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {employeePositions.map((p) => (
                            <span key={p.id}>{p.role ?? "תקן"}</span>
                          ))}
                        </div>
                      ) : (
                        <Badge tone="neutral">לא משובץ</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {employeePositions.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {employeePositions.map((p) => (
                            <span key={p.id}>{p.unitId ? (unitNameById.get(p.unitId) ?? "—") : "—"}</span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {emp.actualUnitId ? (unitNameById.get(emp.actualUnitId) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-3">{emp.actualRole || "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-foreground-subtle">
                      {emp.notes || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            setHistoryEntity({ id: emp.id, label: formatEmployeeName(emp) })
                          }
                          aria-label="היסטוריה"
                          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                        >
                          <HistoryIcon size={16} />
                        </button>
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          aria-label="עריכה"
                          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-foreground-subtle">
                    לא נמצאו עובדים תואמים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {showCreatePosition && (
        <PositionFormModal
          position={null}
          units={units}
          budgetItems={budgetItems}
          onClose={() => setShowCreatePosition(false)}
        />
      )}
      {showCreateEmployee && (
        <EmployeeFormModal employee={null} units={units} onClose={() => setShowCreateEmployee(false)} />
      )}
      {editingEmployee && (
        <EmployeeFormModal
          employee={editingEmployee}
          units={units}
          onClose={() => setEditingEmployee(null)}
          readOnly={!editAllowed}
        />
      )}
      {historyEntity && (
        <HistoryModal
          entityType="employee"
          entityId={historyEntity.id}
          entityLabel={historyEntity.label}
          onClose={() => setHistoryEntity(null)}
        />
      )}
    </div>
  );
}
