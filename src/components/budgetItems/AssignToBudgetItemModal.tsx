"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatEmployeeName, type Employee } from "@/lib/schemas/employee";
import type { BudgetItem } from "@/lib/schemas/unit";
import { useAssignToBudgetItemMutation } from "@/lib/queries/useAssignments";

function toPercentInputValue(v: number | null) {
  return v !== null ? String(Math.round(v * 1000) / 10) : "";
}

export function AssignToBudgetItemModal({
  budgetItem,
  employees,
  existingRoles = [],
  vacant,
  onClose,
}: {
  budgetItem: BudgetItem;
  employees: Employee[];
  existingRoles?: string[];
  /** Remaining approved capacity — used only to prefill a sensible default percent. */
  vacant: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [existingEmployeeId, setExistingEmployeeId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [role, setRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [employmentPercent, setEmploymentPercent] = useState(toPercentInputValue(vacant > 0 ? vacant : null));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assignMutation = useAssignToBudgetItemMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "existing" && !existingEmployeeId) {
      setError('יש לבחור עובד קיים או לעבור למצב "עובד חדש"');
      return;
    }
    if (mode === "new" && (!firstName.trim() || !lastName.trim())) {
      setError("יש למלא שם פרטי ושם משפחה לעובד החדש");
      return;
    }

    const percentValue = employmentPercent === "" ? null : Number(employmentPercent) / 100;
    const startDateValue = startDate ? new Date(startDate).getTime() : null;
    const endDateValue = endDate ? new Date(endDate).getTime() : null;

    try {
      await assignMutation.mutateAsync({
        budgetItem,
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
                  phone: null,
                  actualUnitId: null,
                  actualRole: null,
                  sector: null,
                  source: "ידני",
                  notes: undefined,
                },
              },
        role: role.trim() || null,
        startDate: startDateValue,
        startDateText: null,
        endDate: endDateValue,
        employmentPercent: percentValue,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שיבוץ העובד נכשל. נסה/י שוב.");
    }
  }

  return (
    <Modal title={`שיבוץ עובד לסעיף ${budgetItem.code} · ${budgetItem.label}`} onClose={onClose} wide>
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
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">שם משפחה</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">תעודת זהות</label>
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">תפקיד</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            list="assign-existing-roles"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <datalist id="assign-existing-roles">
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
            <label className="mb-1 block text-sm font-medium">תאריך סיום (אם קיים)</label>
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
