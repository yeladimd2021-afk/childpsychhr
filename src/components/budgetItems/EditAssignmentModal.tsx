"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Assignment } from "@/lib/schemas/assignment";
import type { BudgetItem } from "@/lib/schemas/unit";
import { useUpdateAssignmentMutation } from "@/lib/queries/useAssignments";

function toPercentInputValue(v: number | null) {
  return v !== null ? String(Math.round(v * 1000) / 10) : "";
}
function toDateInputValue(v: number | null) {
  return v !== null ? new Date(v).toISOString().slice(0, 10) : "";
}

export function EditAssignmentModal({
  assignment,
  employeeLabel,
  budgetItem,
  existingRoles = [],
  onClose,
}: {
  assignment: Assignment;
  employeeLabel: string;
  budgetItem: BudgetItem;
  existingRoles?: string[];
  onClose: () => void;
}) {
  const [role, setRole] = useState(assignment.role ?? "");
  const [employmentPercent, setEmploymentPercent] = useState(toPercentInputValue(assignment.employmentPercent));
  const [startDate, setStartDate] = useState(toDateInputValue(assignment.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(assignment.endDate));
  const [notes, setNotes] = useState(assignment.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateAssignmentMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: assignment.id,
        before: assignment,
        values: {
          role: role.trim() || null,
          employmentPercent: employmentPercent === "" ? null : Number(employmentPercent) / 100,
          startDate: startDate ? new Date(startDate).getTime() : null,
          startDateText: assignment.startDateText,
          endDate: endDate ? new Date(endDate).getTime() : null,
          notes: notes || undefined,
        },
        employeeLabel,
        budgetItem,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "עדכון השיבוץ נכשל. נסה/י שוב.");
    }
  }

  return (
    <Modal title={`עריכת שיבוץ — ${employeeLabel}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">תפקיד</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            list="edit-assignment-roles"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <datalist id="edit-assignment-roles">
            {existingRoles.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">תאריך התחלה</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">תאריך סיום</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">אחוז שיבוץ (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={employmentPercent}
              onChange={(e) => setEmploymentPercent(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">הערות</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {updateMutation.isPending ? "שומר..." : "שמירה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
