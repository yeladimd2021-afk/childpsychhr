"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Download, History as HistoryIcon, Pencil, UserMinus, ArrowRightLeft, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { usePositionsQuery } from "@/lib/queries/usePositions";
import { useBudgetItemsQuery, useUnitsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery, useEndAssignmentMutation } from "@/lib/queries/useAssignments";
import { PositionFormModal } from "@/components/positions/PositionFormModal";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { AssignEmployeeModal } from "@/components/employees/AssignEmployeeModal";
import { TransferAssignmentModal } from "@/components/employees/TransferAssignmentModal";
import { HistoryModal } from "@/components/shared/HistoryModal";
import { exportPositionsToExcel } from "@/lib/export/exportPositionsToExcel";
import type { Position } from "@/lib/schemas/position";
import type { Employee } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";
import { isActiveAssignment } from "@/lib/schemas/assignment";

const POSITION_STATUS_TONE = {
  מאויש: "green",
  פנוי: "amber",
  מוקפא: "blue",
  בביטול: "neutral",
} as const;

type Tab = "positions" | "employees";

export default function PositionsPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: positions = [], isLoading: loadingPositions } = usePositionsQuery();
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [] } = useBudgetItemsQuery();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();
  const endAssignmentMutation = useEndAssignmentMutation();

  const [tab, setTab] = useState<Tab>("positions");
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fundingFilter, setFundingFilter] = useState("");
  const [employeeUnitFilter, setEmployeeUnitFilter] = useState("");

  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [showCreatePosition, setShowCreatePosition] = useState(false);
  const [historyEntity, setHistoryEntity] = useState<{ type: "position" | "employee"; id: string; label: string } | null>(null);
  const [assigningPosition, setAssigningPosition] = useState<Position | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ assignment: Assignment; position: Position; label: string } | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const newParam = searchParams.get("new");
    const statusFilterParam = searchParams.get("statusFilter");
    // One-time sync from the URL a quick action arrived with (Control Center) into local
    // state — not a response to external state changing over time, so the usual "don't
    // setState in an effect" guidance doesn't really fit this one-shot deep-link case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tabParam === "employees" || tabParam === "positions") setTab(tabParam);
    if (statusFilterParam) setStatusFilter(statusFilterParam);
    if (newParam === "employee") setShowCreateEmployee(true);
    if (newParam === "position") setShowCreatePosition(true);
    if (tabParam || newParam || statusFilterParam) router.replace("/positions");
    // Only meant to run once, reading whatever query params the Control Center's quick
    // actions arrived with — not meant to react to later changes in searchParams/router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const positionById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);

  const activeAssignmentByPositionId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.positionId, a);
    }
    return map;
  }, [assignments]);

  const activeAssignmentByEmployeeId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.employeeId, a);
    }
    return map;
  }, [assignments]);

  const vacantPositions = useMemo(() => positions.filter((p) => p.status === "פנוי"), [positions]);

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
    if (statusFilter) result = result.filter((p) => p.status === statusFilter);
    if (fundingFilter) result = result.filter((p) => p.fundingSource === fundingFilter);
    return result;
  }, [
    positions,
    search,
    unitFilter,
    statusFilter,
    fundingFilter,
    activeAssignmentByPositionId,
    employeeById,
    unitNameById,
  ]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((e) => formatEmployeeName(e).includes(q) || (e.idNumber ?? "").includes(q));
    }
    if (employeeUnitFilter) {
      result = result.filter((e) => {
        const assignment = activeAssignmentByEmployeeId.get(e.id);
        const position = assignment ? positionById.get(assignment.positionId) : null;
        return position?.unitId === employeeUnitFilter;
      });
    }
    return result;
  }, [employees, search, employeeUnitFilter, activeAssignmentByEmployeeId, positionById]);

  async function handleEndAssignment(position: Position) {
    const assignment = activeAssignmentByPositionId.get(position.id);
    if (!assignment) return;
    const employee = employeeById.get(assignment.employeeId);
    const confirmed = window.confirm(
      `לסיים את השיבוץ של ${formatEmployeeName(employee)} בתקן "${position.role ?? "ללא תפקיד"}"? התקן יהפוך לפנוי.`
    );
    if (!confirmed) return;
    await endAssignmentMutation.mutateAsync({
      assignment,
      position,
      employeeLabel: formatEmployeeName(employee),
    });
  }

  if (loadingPositions || loadingEmployees) {
    return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">עובדים ותקנים</h1>
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
              {(unitFilter || statusFilter || fundingFilter || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setUnitFilter("");
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
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs text-foreground-subtle">
              <tr>
                <th className="px-3 py-3 text-right">תפקיד</th>
                <th className="px-3 py-3 text-right">יחידה</th>
                <th className="px-3 py-3 text-right">מקור</th>
                <th className="px-3 py-3 text-right">%</th>
                <th className="px-3 py-3 text-right">סטטוס</th>
                <th className="px-3 py-3 text-right">עובד נוכחי</th>
                <th className="px-3 py-3 text-right">הערות</th>
                <th className="px-3 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p) => {
                const assignment = activeAssignmentByPositionId.get(p.id);
                const employee = assignment ? employeeById.get(assignment.employeeId) : null;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-background/60">
                    <td className="px-3 py-3 font-medium">{p.role ?? "—"}</td>
                    <td className="px-3 py-3">{p.unitId ? (unitNameById.get(p.unitId) ?? "—") : "—"}</td>
                    <td className="px-3 py-3">{p.fundingSource}</td>
                    <td className="px-3 py-3">
                      {p.employmentPercent !== null ? `${Math.round(p.employmentPercent * 100)}%` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={POSITION_STATUS_TONE[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-3 py-3">{employee ? formatEmployeeName(employee) : "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-foreground-subtle">{p.notes || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setHistoryEntity({ type: "position", id: p.id, label: p.role ?? "תקן" })}
                          aria-label="היסטוריה"
                          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                        >
                          <HistoryIcon size={16} />
                        </button>
                        <button
                          onClick={() => setEditingPosition(p)}
                          aria-label="עריכה"
                          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                        >
                          <Pencil size={16} />
                        </button>
                        {editAllowed && p.status === "פנוי" && (
                          <button
                            onClick={() => setAssigningPosition(p)}
                            aria-label="שבץ עובד"
                            title="שבץ עובד"
                            className="rounded-lg p-1.5 text-brand-blue hover:bg-brand-blue-soft"
                          >
                            <UserPlus size={16} />
                          </button>
                        )}
                        {editAllowed && p.status === "מאויש" && assignment && (
                          <>
                            <button
                              onClick={() =>
                                setTransferTarget({
                                  assignment,
                                  position: p,
                                  label: formatEmployeeName(employee),
                                })
                              }
                              aria-label="העברה לתקן אחר"
                              title="העברה לתקן אחר"
                              className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                            <button
                              onClick={() => handleEndAssignment(p)}
                              aria-label="סיום שיבוץ"
                              title="סיום שיבוץ"
                              className="rounded-lg p-1.5 text-brand-red hover:bg-brand-red-soft"
                            >
                              <UserMinus size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPositions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-foreground-subtle">
                    לא נמצאו תקנים תואמים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs text-foreground-subtle">
              <tr>
                <th className="px-3 py-3 text-right">שם מלא</th>
                <th className="px-3 py-3 text-right">ת.ז.</th>
                <th className="px-3 py-3 text-right">תקן נוכחי</th>
                <th className="px-3 py-3 text-right">יחידה</th>
                <th className="px-3 py-3 text-right">הערות</th>
                <th className="px-3 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const assignment = activeAssignmentByEmployeeId.get(emp.id);
                const position = assignment ? positionById.get(assignment.positionId) : null;
                return (
                  <tr key={emp.id} className="border-t border-border hover:bg-background/60">
                    <td className="px-3 py-3 font-medium">{formatEmployeeName(emp)}</td>
                    <td dir="ltr" className="px-3 py-3 text-left text-foreground-subtle">
                      {emp.idNumber ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {position ? (
                        position.role ?? "תקן"
                      ) : (
                        <Badge tone="neutral">לא משובץ</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {position?.unitId ? (unitNameById.get(position.unitId) ?? "—") : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-foreground-subtle">
                      {emp.notes || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            setHistoryEntity({ type: "employee", id: emp.id, label: formatEmployeeName(emp) })
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
                  <td colSpan={6} className="px-3 py-8 text-center text-foreground-subtle">
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
      {editingPosition && (
        <PositionFormModal
          position={editingPosition}
          units={units}
          budgetItems={budgetItems}
          onClose={() => setEditingPosition(null)}
          readOnly={!editAllowed}
          hasActiveAssignment={activeAssignmentByPositionId.has(editingPosition.id)}
        />
      )}
      {showCreateEmployee && (
        <EmployeeFormModal employee={null} onClose={() => setShowCreateEmployee(false)} />
      )}
      {editingEmployee && (
        <EmployeeFormModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          readOnly={!editAllowed}
        />
      )}
      {assigningPosition && (
        <AssignEmployeeModal
          position={assigningPosition}
          employees={employees}
          onClose={() => setAssigningPosition(null)}
        />
      )}
      {transferTarget && (
        <TransferAssignmentModal
          currentAssignment={transferTarget.assignment}
          currentPosition={transferTarget.position}
          employeeLabel={transferTarget.label}
          vacantPositions={vacantPositions}
          units={units}
          onClose={() => setTransferTarget(null)}
        />
      )}
      {historyEntity && (
        <HistoryModal
          entityType={historyEntity.type}
          entityId={historyEntity.id}
          entityLabel={historyEntity.label}
          onClose={() => setHistoryEntity(null)}
        />
      )}
    </div>
  );
}
