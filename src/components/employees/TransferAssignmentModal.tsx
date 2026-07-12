"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Assignment } from "@/lib/schemas/assignment";
import type { Position } from "@/lib/schemas/position";
import type { Unit } from "@/lib/schemas/unit";
import { useTransferAssignmentMutation } from "@/lib/queries/useAssignments";

function toPercentInputValue(v: number | null) {
  return v !== null ? String(Math.round(v * 1000) / 10) : "";
}

export function TransferAssignmentModal({
  currentAssignment,
  currentPosition,
  employeeLabel,
  vacantPositions,
  units,
  onClose,
}: {
  currentAssignment: Assignment;
  currentPosition: Position;
  employeeLabel: string;
  vacantPositions: Position[];
  units: Unit[];
  onClose: () => void;
}) {
  const [targetPositionId, setTargetPositionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [employmentPercent, setEmploymentPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const transferMutation = useTransferAssignmentMutation();
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const targetPosition = vacantPositions.find((p) => p.id === targetPositionId);
    if (!targetPosition) {
      setError("יש לבחור תקן יעד");
      return;
    }
    await transferMutation.mutateAsync({
      currentAssignment,
      currentPosition,
      targetPosition,
      employeeLabel,
      startDate: startDate ? new Date(startDate).getTime() : null,
      startDateText: null,
      employmentPercent: employmentPercent === "" ? null : Number(employmentPercent) / 100,
      notes: notes || undefined,
    });
    onClose();
  }

  return (
    <Modal title={`העברת ${employeeLabel} לתקן אחר`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-foreground-subtle">
          התקן הנוכחי ({currentPosition.role ?? "ללא תפקיד"}) יתפנה אוטומטית עם ההעברה.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium">תקן יעד (פנוי)</label>
          <select
            value={targetPositionId}
            onChange={(e) => setTargetPositionId(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">— בחר/י —</option>
            {vacantPositions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.role ?? "תקן"} · {p.unitId ? (unitNameById.get(p.unitId) ?? "") : "ללא יחידה"}
              </option>
            ))}
          </select>
          {vacantPositions.length === 0 && (
            <p className="mt-1 text-xs text-brand-red">אין כרגע תקנים פנויים להעברה.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">תאריך תחילת שיבוץ חדש</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">אחוז משרה בתקן החדש (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={employmentPercent}
              onChange={(e) => setEmploymentPercent(e.target.value)}
              placeholder={toPercentInputValue(
                vacantPositions.find((p) => p.id === targetPositionId)?.employmentPercent ?? null
              )}
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
            disabled={transferMutation.isPending || vacantPositions.length === 0}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {transferMutation.isPending ? "מעביר..." : "העברה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
