"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import {
  budgetItemFormSchema,
  type BudgetItem,
  type BudgetItemFormValues,
} from "@/lib/schemas/unit";
import type { Unit } from "@/lib/schemas/unit";
import type { FundingSource } from "@/lib/schemas/position";
import { useCreateBudgetItemMutation, useUpdateBudgetItemMutation } from "@/lib/queries/useUnits";

const FUNDING_SOURCE_OPTIONS: FundingSource[] = ["מדינה", "קרן", "מחקר", "תרומה", "אחר"];

export function BudgetItemFormModal({
  unitId,
  units,
  budgetItem,
  onClose,
}: {
  /** Pre-selected unit (e.g. when adding from a specific unit's context). Still editable. */
  unitId?: string;
  units: Unit[];
  budgetItem: BudgetItem | null;
  onClose: () => void;
}) {
  const createMutation = useCreateBudgetItemMutation();
  const updateMutation = useUpdateBudgetItemMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetItemFormValues>({
    resolver: zodResolver(budgetItemFormSchema),
    defaultValues: budgetItem
      ? { ...budgetItem }
      : {
          unitId: unitId ?? units[0]?.id ?? "",
          code: "",
          label: "",
          fundingSource: "מדינה",
          allocatedQuota: 0,
          notes: "",
        },
  });

  async function onSubmit(values: BudgetItemFormValues) {
    setSubmitError(null);
    try {
      if (budgetItem) {
        await updateMutation.mutateAsync({ id: budgetItem.id, before: budgetItem, values });
      } else {
        await createMutation.mutateAsync(values);
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "שמירת סעיף התקציב נכשלה. נסה/י שוב.");
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal title={budgetItem ? "עריכת סעיף תקציב" : "הוספת סעיף תקציב"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">מספר סעיף תקציב</label>
          <input
            {...register("code")}
            dir="ltr"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          {errors.code && <p className="mt-1 text-xs text-brand-red">{errors.code.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">שם / תיאור</label>
          <input
            {...register("label")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          {errors.label && <p className="mt-1 text-xs text-brand-red">{errors.label.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">יחידה</label>
          <select
            {...register("unitId")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">מקור תקציב</label>
          <select
            {...register("fundingSource")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            {FUNDING_SOURCE_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">סך היקף תקנים מאושר</label>
          <input
            type="number"
            step="0.01"
            {...register("allocatedQuota", { valueAsNumber: true })}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">הערות</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        {Object.keys(errors).length > 0 && (
          <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-xs text-brand-red">
            יש למלא כראוי את כל השדות המסומנים ({Object.keys(errors).join(", ")}) לפני השמירה.
          </p>
        )}
        {submitError && (
          <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-xs text-brand-red">{submitError}</p>
        )}
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
            disabled={submitting}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "שומר..." : "שמירה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
