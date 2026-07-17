"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  UserPlus,
  Repeat,
  ArrowRightLeft,
  UserMinus,
  Snowflake,
  PlayCircle,
  CalendarClock,
  History as HistoryIcon,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PositionFormModal } from "@/components/positions/PositionFormModal";
import { FreezePositionModal } from "@/components/positions/FreezePositionModal";
import { AssignEmployeeModal } from "@/components/employees/AssignEmployeeModal";
import { TransferAssignmentModal } from "@/components/employees/TransferAssignmentModal";
import { FutureChangeFormModal } from "@/components/changes/FutureChangeFormModal";
import { HistoryModal } from "@/components/shared/HistoryModal";
import { useSetPositionStatusMutation, useDeletePositionMutation } from "@/lib/queries/usePositions";
import { useEndAssignmentMutation } from "@/lib/queries/useAssignments";
import type { Position } from "@/lib/schemas/position";
import type { Unit, BudgetItem } from "@/lib/schemas/unit";
import type { Employee } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Assignment } from "@/lib/schemas/assignment";
import { isActiveAssignment } from "@/lib/schemas/assignment";
import type { AuditLogEntry } from "@/lib/schemas/auditLog";
import { computePositionVacancy } from "@/lib/domain/aggregation";
import { getVacantSince } from "@/lib/domain/actionQueue";

const POSITION_STATUS_TONE = {
  מאויש: "green",
  פנוי: "amber",
  מוקפא: "blue",
  בביטול: "neutral",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function pct(v: number | null) {
  return v !== null ? `${Math.round(v * 100)}%` : "—";
}

/** Single shared table + row-action set for every screen that shows positions (ניהול תקנים,
 * תקנים פנויים, and each expanded unit in יחידות ומחלקות) — one place owns the modals and
 * mutations, so a fix or new action here reaches every surface automatically. Callers pass an
 * already-filtered `positions` array; this component doesn't do its own filtering/search. */
export function PositionsTable({
  positions,
  units,
  budgetItems,
  employees,
  assignments,
  editAllowed,
  variant = "full",
  auditEntriesAscending = [],
  emptyMessage = "לא נמצאו תקנים תואמים",
}: {
  positions: Position[];
  units: Unit[];
  budgetItems: BudgetItem[];
  employees: Employee[];
  assignments: Assignment[];
  editAllowed: boolean;
  /** "full" = ניהול תקנים (all columns/actions). "vacant" = תקנים פנויים (vacancy-focused
   * columns, "שבץ עובד" emphasized). "compact" = embedded inside a unit's accordion row. */
  variant?: "full" | "vacant" | "compact";
  /** Only needed for variant="vacant", to compute "כמה זמן פנוי". */
  auditEntriesAscending?: AuditLogEntry[];
  emptyMessage?: string;
}) {
  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const budgetItemById = useMemo(() => new Map(budgetItems.map((b) => [b.id, b])), [budgetItems]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const activeAssignmentByPositionId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignments) {
      if (isActiveAssignment(a)) map.set(a.positionId, a);
    }
    return map;
  }, [assignments]);
  const vacantPositions = useMemo(() => positions.filter((p) => p.status === "פנוי"), [positions]);

  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [viewingPosition, setViewingPosition] = useState<Position | null>(null);
  const [assigningPosition, setAssigningPosition] = useState<Position | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ assignment: Assignment; position: Position; label: string } | null>(null);
  const [freezingPosition, setFreezingPosition] = useState<{ position: Position; employeeLabel: string } | null>(null);
  const [leavingSoonFor, setLeavingSoonFor] = useState<{ position: Position; employee: Employee } | null>(null);
  const [historyPosition, setHistoryPosition] = useState<{ id: string; label: string } | null>(null);
  // Date.now() is impure — read once into state on mount rather than calling it during render.
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);

  const endAssignmentMutation = useEndAssignmentMutation();
  const setPositionStatusMutation = useSetPositionStatusMutation();
  const deletePositionMutation = useDeletePositionMutation();

  async function handleEndAssignment(position: Position) {
    const assignment = activeAssignmentByPositionId.get(position.id);
    if (!assignment) return;
    const employee = employeeById.get(assignment.employeeId);
    const confirmed = window.confirm(
      `לסיים את השיבוץ של ${formatEmployeeName(employee)} בתקן "${position.role ?? "ללא תפקיד"}"? התקן יהפוך לפנוי.`
    );
    if (!confirmed) return;
    await endAssignmentMutation.mutateAsync({ assignment, position, employeeLabel: formatEmployeeName(employee) });
  }

  async function handleReplaceEmployee(position: Position) {
    const assignment = activeAssignmentByPositionId.get(position.id);
    if (!assignment) return;
    const employee = employeeById.get(assignment.employeeId);
    const confirmed = window.confirm(
      `להחליף את ${formatEmployeeName(employee)} בתקן "${position.role ?? "ללא תפקיד"}"? השיבוץ הנוכחי יסתיים, ומיד ניתן יהיה לשבץ עובד/ת אחר/ת.`
    );
    if (!confirmed) return;
    await endAssignmentMutation.mutateAsync({ assignment, position, employeeLabel: formatEmployeeName(employee) });
    setAssigningPosition(position);
  }

  async function handleResumeFromFreeze(position: Position) {
    await setPositionStatusMutation.mutateAsync({
      id: position.id,
      before: position,
      status: "מאויש",
      frozenUntil: null,
    });
  }

  function handleDeletePosition(position: Position) {
    if (activeAssignmentByPositionId.has(position.id)) {
      window.alert(
        `לא ניתן למחוק את התקן "${position.role ?? "ללא תפקיד"}" — יש לו שיבוץ פעיל כרגע. יש לסיים או להעביר את השיבוץ קודם.`
      );
      return;
    }
    const pastAssignments = assignments.filter((a) => a.positionId === position.id);
    const historyWarning =
      pastAssignments.length > 0
        ? `\n\nלתקן זה יש היסטוריית שיבוצים (${pastAssignments.length}) — לאחר המחיקה, ההיסטוריה של מי שהוחזק בו בעבר תישאר ללא קישור לתקן.`
        : "";
    const confirmed = window.confirm(
      `למחוק את התקן "${position.role ?? "ללא תפקיד"}"? פעולה זו סופית ואינה ניתנת לביטול.${historyWarning}`
    );
    if (!confirmed) return;
    deletePositionMutation.mutate({ id: position.id, before: position });
  }

  function RowActions({ p }: { p: Position }) {
    const assignment = activeAssignmentByPositionId.get(p.id);
    const employee = assignment ? employeeById.get(assignment.employeeId) : null;
    const vacancy = computePositionVacancy(p, assignment ?? null);
    const canAssign = editAllowed && (p.status === "פנוי" || (p.status === "מאויש" && vacancy.remaining > 0.001));

    return (
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setViewingPosition(p)}
          aria-label="צפייה"
          title="צפייה"
          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => setEditingPosition(p)}
          aria-label="עריכת תקן"
          title="עריכת תקן"
          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
        >
          <Pencil size={16} />
        </button>
        {canAssign && (
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
              onClick={() => handleReplaceEmployee(p)}
              aria-label="החלפת עובד"
              title="החלפת עובד"
              className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
            >
              <Repeat size={16} />
            </button>
            <button
              onClick={() =>
                setTransferTarget({ assignment, position: p, label: formatEmployeeName(employee) })
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
            <button
              onClick={() => setFreezingPosition({ position: p, employeeLabel: formatEmployeeName(employee) })}
              aria-label="הקפאה זמנית (חופשת לידה/מחלה)"
              title="הקפאה זמנית (חופשת לידה/מחלה)"
              className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
            >
              <Snowflake size={16} />
            </button>
            {employee && (
              <button
                onClick={() => setLeavingSoonFor({ position: p, employee })}
                aria-label="סימון תאריך עזיבה צפוי"
                title="סימון תאריך עזיבה צפוי — כך שהמערכת תתריע כשהתקן מתקרב להתפנות"
                className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
              >
                <CalendarClock size={16} />
              </button>
            )}
          </>
        )}
        {editAllowed && p.status === "מוקפא" && assignment && (
          <button
            onClick={() => handleResumeFromFreeze(p)}
            aria-label="סיום הקפאה — חזרה מחופשה"
            title="סיום הקפאה — חזרה מחופשה"
            className="rounded-lg p-1.5 text-brand-green hover:bg-brand-green-soft"
          >
            <PlayCircle size={16} />
          </button>
        )}
        <button
          onClick={() => setHistoryPosition({ id: p.id, label: p.role ?? "תקן" })}
          aria-label="היסטוריה"
          title="היסטוריה"
          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-background"
        >
          <HistoryIcon size={16} />
        </button>
        {editAllowed && (
          <button
            onClick={() => handleDeletePosition(p)}
            aria-label="מחיקת תקן"
            title="מחיקת תקן"
            className="rounded-lg p-1.5 text-foreground-subtle hover:bg-brand-red-soft hover:text-brand-red"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs text-foreground-subtle">
            <tr>
              <th className="px-3 py-3 text-right">יחידה</th>
              <th className="px-3 py-3 text-right">תפקיד</th>
              {variant === "full" && (
                <>
                  <th className="px-3 py-3 text-right">מקור</th>
                  <th className="px-3 py-3 text-right">סעיף תקציבי</th>
                  <th className="px-3 py-3 text-right">אחוז תקן</th>
                </>
              )}
              {variant === "vacant" && (
                <>
                  <th className="px-3 py-3 text-right">אחוז תקן כולל</th>
                  <th className="px-3 py-3 text-right">אחוז מאויש</th>
                  <th className="px-3 py-3 text-right">יתרה פנויה</th>
                  <th className="px-3 py-3 text-right">מקור</th>
                  <th className="px-3 py-3 text-right">פנוי כמה זמן</th>
                </>
              )}
              <th className="px-3 py-3 text-right">סטטוס</th>
              <th className="px-3 py-3 text-right">עובד משובץ</th>
              {variant === "full" && (
                <>
                  <th className="px-3 py-3 text-right">אחוז שיבוץ</th>
                  <th className="px-3 py-3 text-right">תאריך התחלה</th>
                </>
              )}
              {variant !== "compact" && <th className="px-3 py-3 text-right">הערות</th>}
              <th className="px-3 py-3 text-right">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const assignment = activeAssignmentByPositionId.get(p.id);
              const employee = assignment ? employeeById.get(assignment.employeeId) : null;
              const vacancy = computePositionVacancy(p, assignment ?? null);
              const vacantSince =
                variant === "vacant" && p.status === "פנוי" && now !== null
                  ? Math.floor((now - getVacantSince(p, auditEntriesAscending)) / DAY_MS)
                  : null;

              return (
                <tr key={p.id} className="border-t border-border hover:bg-background/60">
                  <td className="px-3 py-3">{p.unitId ? (unitNameById.get(p.unitId) ?? "—") : "—"}</td>
                  <td className="px-3 py-3 font-medium">{p.role ?? "—"}</td>
                  {variant === "full" && (
                    <>
                      <td className="px-3 py-3">{p.fundingSource}</td>
                      <td className="px-3 py-3">
                        {p.budgetItemId ? (budgetItemById.get(p.budgetItemId)?.label ?? "—") : "—"}
                      </td>
                      <td className="px-3 py-3">{pct(p.employmentPercent)}</td>
                    </>
                  )}
                  {variant === "vacant" && (
                    <>
                      <td className="px-3 py-3">{pct(vacancy.total)}</td>
                      <td className="px-3 py-3">{pct(vacancy.filled)}</td>
                      <td className="px-3 py-3 font-medium text-brand-amber">{pct(vacancy.remaining)}</td>
                      <td className="px-3 py-3">{p.fundingSource}</td>
                      <td className="px-3 py-3">{vacantSince !== null ? `${vacantSince} ימים` : "—"}</td>
                    </>
                  )}
                  <td className="px-3 py-3">
                    <Badge tone={POSITION_STATUS_TONE[p.status]}>{p.status}</Badge>
                    {p.status === "מוקפא" && p.frozenUntil && (
                      <p className="mt-1 text-xs text-foreground-subtle">
                        עד {new Date(p.frozenUntil).toLocaleDateString("he-IL")}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">{employee ? formatEmployeeName(employee) : "—"}</td>
                  {variant === "full" && (
                    <>
                      <td className="px-3 py-3">{assignment ? pct(assignment.employmentPercent) : "—"}</td>
                      <td className="px-3 py-3">
                        {assignment?.startDate
                          ? new Date(assignment.startDate).toLocaleDateString("he-IL")
                          : (assignment?.startDateText ?? "—")}
                      </td>
                    </>
                  )}
                  {variant !== "compact" && (
                    <td className="max-w-[160px] truncate px-3 py-3 text-foreground-subtle">{p.notes || "—"}</td>
                  )}
                  <td className="px-3 py-3">
                    {variant === "vacant" ? (
                      <div className="flex items-center gap-2">
                        {editAllowed && (
                          <button
                            onClick={() => setAssigningPosition(p)}
                            className="flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
                          >
                            <UserPlus size={14} />
                            שבץ עובד
                          </button>
                        )}
                        <RowActions p={p} />
                      </div>
                    ) : (
                      <RowActions p={p} />
                    )}
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-foreground-subtle">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(editingPosition || viewingPosition) && (
        <PositionFormModal
          position={editingPosition ?? viewingPosition}
          units={units}
          budgetItems={budgetItems}
          onClose={() => {
            setEditingPosition(null);
            setViewingPosition(null);
          }}
          readOnly={!editAllowed || !!viewingPosition}
          hasActiveAssignment={activeAssignmentByPositionId.has((editingPosition ?? viewingPosition)!.id)}
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
      {freezingPosition && (
        <FreezePositionModal
          position={freezingPosition.position}
          employeeLabel={freezingPosition.employeeLabel}
          onClose={() => setFreezingPosition(null)}
        />
      )}
      {leavingSoonFor && (
        <FutureChangeFormModal
          change={null}
          positions={positions}
          units={units}
          prefill={{
            firstName: leavingSoonFor.employee.firstName,
            lastName: leavingSoonFor.employee.lastName,
            changeType: "עזיבה",
            status: "מתוכנן",
            relatedPositionId: leavingSoonFor.position.id,
            employmentPercent: leavingSoonFor.position.employmentPercent,
            fundingSource: leavingSoonFor.position.fundingSource,
          }}
          onClose={() => setLeavingSoonFor(null)}
        />
      )}
      {historyPosition && (
        <HistoryModal
          entityType="position"
          entityId={historyPosition.id}
          entityLabel={historyPosition.label}
          onClose={() => setHistoryPosition(null)}
        />
      )}
    </>
  );
}
