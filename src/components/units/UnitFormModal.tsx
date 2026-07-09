"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { unitFormSchema, type Unit, type UnitFormValues } from "@/lib/schemas/unit";
import { useCreateUnitMutation, useUpdateUnitMutation } from "@/lib/queries/useUnits";

export function UnitFormModal({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  const createMutation = useCreateUnitMutation();
  const updateMutation = useUpdateUnitMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: unit ? { ...unit } : { name: "", notes: "", order: 0 },
  });

  async function onSubmit(values: UnitFormValues) {
    if (unit) {
      await updateMutation.mutateAsync({ id: unit.id, before: unit, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    onClose();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal title={unit ? "עריכת יחידה" : "הוספת יחידה"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">שם היחידה</label>
          <input
            {...register("name")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          {errors.name && <p className="mt-1 text-xs text-brand-red">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">הערות ניהוליות</label>
          <textarea
            {...register("notes")}
            rows={3}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">סדר תצוגה</label>
          <input
            type="number"
            {...register("order", { valueAsNumber: true })}
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
