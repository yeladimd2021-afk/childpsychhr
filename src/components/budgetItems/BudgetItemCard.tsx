"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, UserPlus, Pencil, Trash2, History as HistoryIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { BudgetItemStats } from "@/lib/domain/aggregation";
import { round2 } from "@/lib/domain/aggregation";
import type { Unit } from "@/lib/schemas/unit";
import type { Employee } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";
import { useEndAssignmentMutation } from "@/lib/queries/useAssignments";
import { useDeleteBudgetItemMutation } from "@/lib/queries/useUnits";
import { BudgetItemFormModal } from "@/components/units/BudgetItemFormModal";
import { AssignToBudgetItemModal } from "@/components/budgetItems/AssignToBudgetItemModal";
import { EditAssignmentModal } from "@/components/budgetItems/EditAssignmentModal";
import { HistoryModal } from "@/components/shared/HistoryModal";

export function BudgetItemCard({
  stats,
  unit,
  units,
  employees,
  editAllowed,
  existingRoles,
  defaultExpanded = false,
}: {
  stats: BudgetItemStats;
  unit: Unit | undefined;
  units: Unit[];
  employees: Employee[];
  editAllowed: boolean;
  existingRoles: string[];
  defaultExpanded?: boolean;
}) {
  const { budgetItem, occupied, vacant, activeAssignments, overCapacity } = stats;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [historyAssignment, setHistoryAssignment] = useState<Assignment | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const endMutation = useEndAssignmentMutation();
  const deleteMutation = useDeleteBudgetItemMutation();

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const occupancyPct = budgetItem.allocatedQuota > 0 ? Math.round((occupied / budgetItem.allocatedQuota) * 100) : 0;

  function handleDelete() {
    if (activeAssignments.length > 0) {
      window.alert(`לא ניתן למחוק את "${budgetItem.label}" — יש לו ${activeAssignments.length} שיבוצים פעילים. יש לסיים אותם קודם.`);
      return;
    }
    const confirmed = window.confirm(`למחוק את סעיף התקציב "${budgetItem.label}" (${budgetItem.code})? פעולה זו סופית ואינה ניתנת לביטול.`);
    if (!confirmed) return;
    deleteMutation.mutate({ id: budgetItem.id, before: budgetItem });
  }

  function handleEnd(assignment: Assignment) {
    const employee = employeeById.get(assignment.employeeId);
    const label = formatEmployeeName(employee);
    const confirmed = window.confirm(`לסיים את השיבוץ של ${label}?`);
    if (!confirmed) return;
    endMutation.mutate({ assignment, employeeLabel: label, budgetItem });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 text-right">
          {expanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
          <span className="font-medium">
            {budgetItem.code} · {budgetItem.label}
          </span>
        </button>
        {unit && <Badge tone="neutral">{unit.name}</Badge>}
        <Badge tone="blue">{budgetItem.fundingSource}</Badge>
        <span className="text-xs text-foreground-subtle">
          מאושר {round2(budgetItem.allocatedQuota)} · מאויש {round2(occupied)} · פנוי {round2(Math.max(0, vacant))} ·{" "}
          {occupancyPct}% איוש
        </span>
        <div className="flex-1" />
        {editAllowed && (
          <>
            {vacant > 0.005 ? (
              <button
                onClick={() => setAssigning(true)}
                className="flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
              >
                <UserPlus size={14} />
                שבץ עובד
              </button>
            ) : (
              <Badge tone="green">מלא</Badge>
            )}
            <button
              onClick={() => setEditing(true)}
              aria-label="עריכת סעיף"
              title="עריכת סעיף"
              className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              aria-label="מחיקת סעיף"
              title="מחיקת סעיף"
              className="rounded-lg p-1.5 text-foreground-subtle hover:bg-brand-red-soft hover:text-brand-red"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
        <button
          onClick={() => setShowHistory(true)}
          aria-label="היסטוריית סעיף"
          title="היסטוריית סעיף"
          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
        >
          <HistoryIcon size={14} />
        </button>
      </div>

      {overCapacity && (
        <p className="border-t border-border bg-brand-red-soft px-4 py-1.5 text-xs text-brand-red">
          ⚠ סך השיבוצים ({round2(occupied)}) חורג מהתקן המאושר ({round2(budgetItem.allocatedQuota)})
        </p>
      )}

      {expanded && (
        <div className="border-t border-border">
          {activeAssignments.length === 0 ? (
            <p className="px-4 py-3 text-sm text-foreground-subtle">אין עדיין עובדים משובצים בסעיף זה</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-foreground-subtle">
                  <th className="px-4 py-2 text-right font-normal">עובד</th>
                  <th className="px-4 py-2 text-right font-normal">תפקיד</th>
                  <th className="px-4 py-2 text-right font-normal">אחוז</th>
                  <th className="px-4 py-2 text-right font-normal">מ-תאריך</th>
                  <th className="px-4 py-2 text-right font-normal">עד תאריך</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeAssignments.map((a) => {
                  const employee = employeeById.get(a.employeeId);
                  const label = formatEmployeeName(employee);
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{label}</td>
                      <td className="px-4 py-2">{a.role ?? "—"}</td>
                      <td className="px-4 py-2">{a.employmentPercent !== null ? `${round2(a.employmentPercent * 100)}%` : "—"}</td>
                      <td className="px-4 py-2">{a.startDate ? new Date(a.startDate).toLocaleDateString("he-IL") : "—"}</td>
                      <td className="px-4 py-2">{a.endDate ? new Date(a.endDate).toLocaleDateString("he-IL") : "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {editAllowed && (
                            <>
                              <button
                                onClick={() => handleEnd(a)}
                                title="סיום שיבוץ"
                                className="rounded p-1 text-foreground-subtle hover:bg-brand-red-soft hover:text-brand-red"
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={() => setEditingAssignment(a)}
                                title="עריכת שיבוץ"
                                className="rounded p-1 text-foreground-subtle hover:bg-background"
                              >
                                <Pencil size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setHistoryAssignment(a)}
                            title="היסטוריית שיבוץ"
                            className="rounded p-1 text-foreground-subtle hover:bg-background"
                          >
                            <HistoryIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {assigning && (
        <AssignToBudgetItemModal
          budgetItem={budgetItem}
          employees={employees}
          existingRoles={existingRoles}
          vacant={vacant}
          onClose={() => setAssigning(false)}
        />
      )}
      {editing && <BudgetItemFormModal unitId={budgetItem.unitId} units={units} budgetItem={budgetItem} onClose={() => setEditing(false)} />}
      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          employeeLabel={formatEmployeeName(employeeById.get(editingAssignment.employeeId))}
          budgetItem={budgetItem}
          existingRoles={existingRoles}
          onClose={() => setEditingAssignment(null)}
        />
      )}
      {historyAssignment && (
        <HistoryModal
          entityType="assignment"
          entityId={historyAssignment.id}
          entityLabel={`${formatEmployeeName(employeeById.get(historyAssignment.employeeId))} → ${budgetItem.code}`}
          onClose={() => setHistoryAssignment(null)}
        />
      )}
      {showHistory && (
        <HistoryModal
          entityType="budgetItem"
          entityId={budgetItem.id}
          entityLabel={`${budgetItem.code} · ${budgetItem.label}`}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
