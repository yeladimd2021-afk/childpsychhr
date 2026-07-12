"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { employeeFormSchema, type Employee, type EmployeeFormValues } from "@/lib/schemas/employee";
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from "@/lib/queries/useEmployees";
import type { Unit } from "@/lib/schemas/unit";

export function EmployeeFormModal({
  employee,
  units,
  onClose,
  readOnly = false,
}: {
  employee: Employee | null;
  units: Unit[];
  onClose: () => void;
  readOnly?: boolean;
}) {
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee
      ? {
          ...employee,
          phone: employee.phone ?? null,
          actualUnitId: employee.actualUnitId ?? null,
          actualRole: employee.actualRole ?? null,
        }
      : {
          firstName: "",
          lastName: "",
          idNumber: null,
          phone: null,
          actualUnitId: null,
          actualRole: null,
          source: "ידני",
          notes: "",
        },
  });

  async function onSubmit(values: EmployeeFormValues) {
    if (employee) {
      await updateMutation.mutateAsync({ id: employee.id, before: employee, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    onClose();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal title={employee ? "עריכת עובד" : "הוספת עובד"} onClose={onClose}>
      <fieldset disabled={readOnly} className="contents">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                שם פרטי <span className="text-brand-red">*</span>
              </label>
              <input
                {...register("firstName")}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-brand-red">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                שם משפחה <span className="text-brand-red">*</span>
              </label>
              <input
                {...register("lastName")}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-brand-red">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">תעודת זהות</label>
              <input
                {...register("idNumber")}
                dir="ltr"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">טלפון</label>
              <input
                {...register("phone")}
                dir="ltr"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">מחלקה/מרפאה בפועל</label>
              <select
                {...register("actualUnitId")}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">— ללא —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-foreground-subtle">
                היכן העובד/ת נמצא/ת בפועל — יכול להיות שונה מהיחידה של התקן התקציבי
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">תפקיד בפועל</label>
              <input
                {...register("actualRole")}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">הערות</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          {!readOnly && (
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
          )}
        </form>
      </fieldset>
    </Modal>
  );
}
