"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { employeeFormSchema, type Employee, type EmployeeFormValues } from "@/lib/schemas/employee";
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from "@/lib/queries/useEmployees";

export function EmployeeFormModal({
  employee,
  onClose,
  readOnly = false,
}: {
  employee: Employee | null;
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
      ? { ...employee }
      : { firstName: "", lastName: "", idNumber: null, source: "ידני", notes: "" },
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

          <div>
            <label className="mb-1 block text-sm font-medium">תעודת זהות</label>
            <input
              {...register("idNumber")}
              dir="ltr"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
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
