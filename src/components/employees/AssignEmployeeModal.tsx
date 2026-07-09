"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatEmployeeName, type Employee } from "@/lib/schemas/employee";
import type { Position } from "@/lib/schemas/position";
import { useAssignEmployeeMutation } from "@/lib/queries/useAssignments";

function toPercentInputValue(v: number | null) {
  return v !== null ? String(Math.round(v * 100)) : "";
}

export function AssignEmployeeModal({
  position,
  employees,
  onClose,
}: {
  position: Position;
  employees: Employee[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [existingEmployeeId, setExistingEmployeeId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [employmentPercent, setEmploymentPercent] = useState(
    toPercentInputValue(position.employmentPercent)
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assignMutation = useAssignEmployeeMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "existing" && !existingEmployeeId) {
      setError("יש לבחור עובד קיים או לעבור למצב \"עובד חדש\"");
      return;
    }
    if (mode === "new" && (!firstName.trim() || !lastName.trim())) {
      setError("יש למלא שם פרטי ושם משפחה לעובד החדש");
      return;
    }

    const percentValue = employmentPercent === "" ? null : Number(employmentPercent) / 100;
    const startDateValue = startDate ? new Date(startDate).getTime() : null;

    await assignMutation.mutateAsync({
      position,
      employee:
        mode === "existing"
          ? {
              mode: "existing",
              employeeId: existingEmployeeId,
              label: formatEmployeeName(employees.find((e) => e.id === existingEmployeeId)),
            }
          : {
              mode: "new",
              values: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                idNumber: idNumber.trim() || null,
                source: "ידני",
                notes: undefined,
              },
            },
      startDate: startDateValue,
      startDateText: null,
      employmentPercent: percentValue,
      notes: notes || undefined,
    });
    onClose();
  }

  return (
    <Modal title={`שיבוץ עובד לתקן${position.role ? ` — ${position.role}` : ""}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === "existing" ? "bg-brand-blue text-white" : "bg-background text-foreground-subtle"
            }`}
          >
            עובד קיים
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === "new" ? "bg-brand-blue text-white" : "bg-background text-foreground-subtle"
            }`}
          >
            עובד חדש
          </button>
        </div>

        {mode === "existing" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">בחר/י עובד</label>
            <select
              value={existingEmployeeId}
              onChange={(e) => setExistingEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">— בחר/י —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {formatEmployeeName(emp)}
                  {emp.idNumber ? ` (${emp.idNumber})` : ""}
                </option>
              ))}
            </select>
            {employees.length === 0 && (
              <p className="mt-1 text-xs text-foreground-subtle">
                אין עדיין עובדים במערכת — עברו ל&quot;עובד חדש&quot;.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">שם פרטי</label>
              <input
                name="newEmployeeFirstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">שם משפחה</label>
              <input
                name="newEmployeeLastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">תעודת זהות</label>
              <input
                name="newEmployeeIdNumber"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
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
            <label className="mb-1 block text-sm font-medium">אחוז משרה בשיבוץ (%)</label>
            <input
              type="number"
              min={0}
              max={100}
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
            disabled={assignMutation.isPending}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {assignMutation.isPending ? "משבץ..." : "שיבוץ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
