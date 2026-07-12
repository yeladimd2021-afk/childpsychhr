"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Position } from "@/lib/schemas/position";
import { useSetPositionStatusMutation } from "@/lib/queries/usePositions";

/** Freezes an occupied position (e.g. maternity/long-term leave) while keeping the current
 * assignment intact — the employee stays linked to the position, status just becomes מוקפא
 * with an expected return date, so resuming later is a single click rather than re-assigning
 * from scratch. */
export function FreezePositionModal({
  position,
  employeeLabel,
  onClose,
}: {
  position: Position;
  employeeLabel: string;
  onClose: () => void;
}) {
  const [frozenUntil, setFrozenUntil] = useState("");
  const setStatusMutation = useSetPositionStatusMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await setStatusMutation.mutateAsync({
      id: position.id,
      before: position,
      status: "מוקפא",
      frozenUntil: frozenUntil ? new Date(frozenUntil).getTime() : null,
    });
    onClose();
  }

  return (
    <Modal title={`הקפאה זמנית — ${employeeLabel}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-foreground-subtle">
          התקן &quot;{position.role ?? "ללא תפקיד"}&quot; יעבור למצב &quot;מוקפא&quot;. השיבוץ של{" "}
          {employeeLabel} לתקן נשאר כפי שהוא — אין צורך לשבץ מחדש כשהיא/הוא חוזר/ת.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">מוקפא עד תאריך (לא חובה)</label>
          <input
            type="date"
            value={frozenUntil}
            onChange={(e) => setFrozenUntil(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
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
            disabled={setStatusMutation.isPending}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {setStatusMutation.isPending ? "מקפיא..." : "הקפאה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
