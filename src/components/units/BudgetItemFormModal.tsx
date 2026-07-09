"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import {
  budgetItemFormSchema,
  type BudgetItem,
  type BudgetItemFormValues,
} from "@/lib/schemas/unit";
import { useCreateBudgetItemMutation, useUpdateBudgetItemMutation } from "@/lib/queries/useUnits";

export function BudgetItemFormModal({
  unitId,
  budgetItem,
  onClose,
}: {
  unitId: string;
  budgetItem: BudgetItem | null;
  onClose: () => void;
}) {
  const createMutation = useCreateBudgetItemMutation();
  const updateMutation = useUpdateBudgetItemMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetItemFormValues>({
    resolver: zodResolver(budgetItemFormSchema),
    defaultValues: budgetItem
      ? { ...budgetItem }
      : { unitId, code: "", label: "", allocatedQuota: 0, notes: "" },
  });

  async function onSubmit(values: BudgetItemFormValues) {
    if (budgetItem) {
      await updateMutation.mutateAsync({ id: budgetItem.id, before: budgetItem, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    onClose();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal title={budgetItem ? "עריכת סעיף תקציב" : "הוספת סעיף תקציב"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">קוד סעיף</label>
          <input
            {...register("code")}
            dir="ltr"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">תיאור</label>
          <input
            {...register("label")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          {errors.label && <p className="mt-1 text-xs text-brand-red">{errors.label.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">תקן מוקצה</label>
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
