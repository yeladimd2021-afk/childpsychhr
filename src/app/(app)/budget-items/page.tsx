"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, History as HistoryIcon, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { useUnitsQuery, useBudgetItemsQuery } from "@/lib/queries/useUnits";
import { useEmployeesQuery } from "@/lib/queries/useEmployees";
import { useAssignmentsQuery } from "@/lib/queries/useAssignments";
import { computeBudgetItemStats, computeBudgetItemsSummary, round2 } from "@/lib/domain/aggregation";
import { isActiveAssignment } from "@/lib/schemas/assignment";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Employee } from "@/lib/schemas/employee";
import { BudgetItemCard } from "@/components/budgetItems/BudgetItemCard";
import { BudgetItemFormModal } from "@/components/units/BudgetItemFormModal";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { HistoryModal } from "@/components/shared/HistoryModal";

type Tab = "budgetItems" | "employees";

export default function BudgetItemsPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: units = [] } = useUnitsQuery();
  const { data: budgetItems = [], isLoading: loadingBudgetItems } = useBudgetItemsQuery();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();

  const [tab, setTab] = useState<Tab>("budgetItems");
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [onlyVacant, setOnlyVacant] = useState(false);
  const [employeeUnitFilter, setEmployeeUnitFilter] = useState("");

  const [showCreateBudgetItem, setShowCreateBudgetItem] = useState(false);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [historyEntity, setHistoryEntity] = useState<{ id: string; label: string } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const newParam = searchParams.get("new");
    const searchParam = searchParams.get("search");
    const onlyVacantParam = searchParams.get("onlyVacant");
    // One-time sync from the URL a quick action arrived with (Control Center) into local
    // state — not a response to external state changing over time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tabParam === "employees" || tabParam === "budgetItems") setTab(tabParam);
    if (searchParam) setSearch(searchParam);
    if (onlyVacantParam) setOnlyVacant(true);
    if (newParam === "employee") setShowCreateEmployee(true);
    if (newParam === "budgetItem") setShowCreateBudgetItem(true);
    if (tabParam || newParam || searchParam || onlyVacantParam) router.replace("/budget-items");
    // Only meant to run once, reading whatever query params the Control Center's quick
    // actions arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const existingRoles = useMemo(
    () => [...new Set(assignments.map((a) => a.role).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, "he")),
    [assignments]
  );

  const stats = useMemo(() => computeBudgetItemStats(budgetItems, assignments), [budgetItems, assignments]);
  const summary = useMemo(() => computeBudgetItemsSummary(budgetItems, assignments), [budgetItems, assignments]);

  const filteredStats = useMemo(() => {
    let result = stats;
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((s) => {
        const unitName = s.budgetItem.unitId ? (unitNameById.get(s.budgetItem.unitId) ?? "") : "";
        const employeeNames = s.activeAssignments
          .map((a) => formatEmployeeName(employeeById.get(a.employeeId)))
          .join(" ");
        return (
          s.budgetItem.code.includes(q) ||
          s.budgetItem.label.includes(q) ||
          unitName.includes(q) ||
          employeeNames.includes(q)
        );
      });
    }
    if (unitFilter) result = result.filter((s) => s.budgetItem.unitId === unitFilter);
    if (sourceFilter) result = result.filter((s) => s.budgetItem.fundingSource === sourceFilter);
    if (onlyVacant) result = result.filter((s) => s.vacant > 0.005);
    return result;
  }, [stats, search, unitFilter, sourceFilter, onlyVacant, unitNameById, employeeById]);

  // An employee can hold more than one active assignment at once (e.g. split across a few
  // budget items) — keyed to a list, not a single Assignment.
  const activeAssignmentsByEmployeeId = useMemo(() => {
    const map = new Map<string, typeof assignments>();
    for (const a of assignments) {
      if (!isActiveAssignment(a)) continue;
      const list = map.get(a.employeeId) ?? [];
      list.push(a);
      map.set(a.employeeId, list);
    }
    return map;
  }, [assignments]);

  const budgetItemById = useMemo(() => new Map(budgetItems.map((b) => [b.id, b])), [budgetItems]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((e) => formatEmployeeName(e).includes(q) || (e.idNumber ?? "").includes(q));
    }
    if (employeeUnitFilter) {
      result = result.filter((e) => {
        const employeeAssignments = activeAssignmentsByEmployeeId.get(e.id) ?? [];
        return employeeAssignments.some((a) => budgetItemById.get(a.budgetItemId ?? "")?.unitId === employeeUnitFilter);
      });
    }
    return result;
  }, [employees, search, employeeUnitFilter, activeAssignmentsByEmployeeId, budgetItemById]);

  if (loadingBudgetItems || loadingEmployees) {
    return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">סעיפי תקציב ותקינה</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            {budgetItems.length} סעיפי תקציב · {employees.length} עובדים
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editAllowed && tab === "budgetItems" && (
            <button
              onClick={() => setShowCreateBudgetItem(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              <Plus size={18} />
              הוספת סעיף תקציב
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

      {tab === "budgetItems" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">סה&quot;כ סעיפים</p>
            <p className="mt-1 text-xl font-semibold">{summary.total}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">מאוישים במלואם</p>
            <p className="mt-1 text-xl font-semibold text-brand-green">{summary.fullyOccupied}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">עם יתרה פנויה</p>
            <p className="mt-1 text-xl font-semibold text-brand-amber">{summary.vacant}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">חורגים מהמאושר</p>
            <p className="mt-1 text-xl font-semibold text-brand-red">{summary.overCapacity}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-foreground-subtle">אחוז איוש</p>
            <p className="mt-1 text-xl font-semibold">{summary.occupancyRate}%</p>
          </Card>
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("budgetItems")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "budgetItems" ? "border-brand-blue text-brand-blue" : "border-transparent text-foreground-subtle"
          }`}
        >
          סעיפי תקציב
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
        <div className="flex flex-wrap items-center gap-3">
          <input
            placeholder={tab === "budgetItems" ? "חיפוש לפי מספר/שם סעיף, יחידה או עובד" : "חיפוש לפי שם או ת.ז."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          {tab === "budgetItems" ? (
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
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">כל מקורות התקציב</option>
                <option value="מדינה">מדינה</option>
                <option value="קרן">קרן</option>
                <option value="מחקר">מחקר</option>
                <option value="תרומה">תרומה</option>
                <option value="אחר">אחר</option>
              </select>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={onlyVacant} onChange={(e) => setOnlyVacant(e.target.checked)} />
                רק עם יתרה פנויה
              </label>
              {(unitFilter || sourceFilter || onlyVacant || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setUnitFilter("");
                    setSourceFilter("");
                    setOnlyVacant(false);
                    setSearch("");
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-blue hover:underline"
                >
                  נקה סינון
                </button>
              )}
            </>
          ) : (
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

      {tab === "budgetItems" ? (
        <div className="flex flex-col gap-3">
          {filteredStats.map((s) => (
            <BudgetItemCard
              key={s.budgetItem.id}
              stats={s}
              unit={s.budgetItem.unitId ? unitById.get(s.budgetItem.unitId) : undefined}
              units={units}
              employees={employees}
              editAllowed={editAllowed}
              existingRoles={existingRoles}
            />
          ))}
          {filteredStats.length === 0 && (
            <Card className="py-8 text-center text-sm text-foreground-subtle">לא נמצאו סעיפי תקציב תואמים</Card>
          )}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs text-foreground-subtle">
              <tr>
                <th className="px-3 py-3 text-right">שם מלא</th>
                <th className="px-3 py-3 text-right">ת.ז.</th>
                <th className="px-3 py-3 text-right">טלפון</th>
                <th className="px-3 py-3 text-right">שיבוצים</th>
                <th className="px-3 py-3 text-right">מחלקה בפועל</th>
                <th className="px-3 py-3 text-right">תפקיד בפועל</th>
                <th className="px-3 py-3 text-right">הערות</th>
                <th className="px-3 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const employeeAssignments = activeAssignmentsByEmployeeId.get(emp.id) ?? [];
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
                      {employeeAssignments.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {employeeAssignments.map((a) => {
                            const budgetItem = a.budgetItemId ? budgetItemById.get(a.budgetItemId) : undefined;
                            return (
                              <div key={a.id}>
                                <span className="font-medium">{a.role ?? "ללא תפקיד"}</span>
                                <span className="text-foreground-subtle">
                                  {" "}
                                  — {a.employmentPercent !== null ? `${round2(a.employmentPercent * 100)}%` : "—"}
                                </span>
                                {budgetItem && (
                                  <p className="pr-2 text-xs text-foreground-subtle">
                                    {budgetItem.code} · {budgetItem.label} ({unitNameById.get(budgetItem.unitId) ?? "—"})
                                  </p>
                                )}
                              </div>
                            );
                          })}
                          {employeeAssignments.length > 1 && (
                            <p className="text-xs font-medium">
                              סה&quot;כ:{" "}
                              {round2(
                                employeeAssignments.reduce((sum, a) => sum + (a.employmentPercent ?? 0), 0) * 100
                              )}
                              %
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge tone="neutral">לא משובץ</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {emp.actualUnitId ? (unitNameById.get(emp.actualUnitId) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-3">{emp.actualRole || "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-foreground-subtle">{emp.notes || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setHistoryEntity({ id: emp.id, label: formatEmployeeName(emp) })}
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
                  <td colSpan={8} className="px-3 py-8 text-center text-foreground-subtle">
                    לא נמצאו עובדים תואמים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {showCreateBudgetItem && (
        <BudgetItemFormModal units={units} budgetItem={null} onClose={() => setShowCreateBudgetItem(false)} />
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
