"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { useState } from "react";
import {
  ACTUAL_ROLE_OPTIONS,
  employeeFormSchema,
  formatEmployeeName,
  isEmployeeActive,
  type Employee,
  type EmployeeFormValues,
} from "@/lib/schemas/employee";
import {
  useCreateEmployeeMutation,
  useSetEmployeeActiveMutation,
  useUpdateEmployeeMutation,
} from "@/lib/queries/useEmployees";
import type { Unit } from "@/lib/schemas/unit";
import type { Assignment } from "@/lib/schemas/assignment";

const SECTOR_OPTIONS = ["רופאים", "מנהל ומשק", "פרא-מקצועות הבריאות"] as const;

export function EmployeeFormModal({
  employee,
  units,
  activeAssignments = [],
  onClose,
  readOnly = false,
}: {
  employee: Employee | null;
  units: Unit[];
  /** This employee's currently-active assignments — used only to warn/end them when marking
   * the employee inactive. Irrelevant (and safe to omit) in create mode. */
  activeAssignments?: Assignment[];
  onClose: () => void;
  readOnly?: boolean;
}) {
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const setActiveMutation = useSetEmployeeActiveMutation();
  const [activeError, setActiveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee
      ? {
          ...employee,
          phone: employee.phone ?? null,
          actualUnitId: employee.actualUnitId ?? null,
          actualRole: employee.actualRole ?? null,
          sector: employee.sector ?? null,
          active: isEmployeeActive(employee),
        }
      : {
          firstName: "",
          lastName: "",
          idNumber: null,
          phone: null,
          actualUnitId: null,
          actualRole: null,
          sector: null,
          active: true,
          source: "ידני",
          notes: "",
        },
  });

  async function handleToggleActive() {
    if (!employee) return;
    setActiveError(null);
    const goingInactive = isEmployeeActive(employee);
    if (goingInactive && activeAssignments.length > 0) {
      const confirmed = window.confirm(
        `סימון ${formatEmployeeName(employee)} כלא פעיל/ה יסיים גם ${activeAssignments.length} שיבוצים פעילים שלו/ה. להמשיך?`
      );
      if (!confirmed) return;
    }
    try {
      await setActiveMutation.mutateAsync({
        employee,
        active: !goingInactive,
        activeAssignmentIds: goingInactive ? activeAssignments.map((a) => a.id) : [],
      });
      onClose();
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : "העדכון נכשל. נסה/י שוב.");
    }
  }

  const currentActualRole = employee?.actualRole ?? null;
  const actualRoleOptions =
    currentActualRole && !(ACTUAL_ROLE_OPTIONS as readonly string[]).includes(currentActualRole)
      ? [currentActualRole, ...ACTUAL_ROLE_OPTIONS]
      : ACTUAL_ROLE_OPTIONS;

  async function onSubmit(values: EmployeeFormValues) {
    if (employee) {
      await updateMutation.mutateAsync({ id: employee.id, before: employee, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    onClose();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  const employeeActive = employee ? isEmployeeActive(employee) : true;

  return (
    <Modal title={employee ? "עריכת עובד" : "הוספת עובד"} onClose={onClose}>
      <fieldset disabled={readOnly} className="contents">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {employee && !employeeActive && (
            <p className="rounded-lg bg-brand-amber-soft px-3 py-2 text-sm text-brand-amber">
              עובד/ת זו מסומנ/ת כלא פעיל/ה (עזב/ה).
            </p>
          )}
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
              <label className="mb-1 block text-sm font-medium">מחלקה</label>
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
              <label className="mb-1 block text-sm font-medium">תפקיד</label>
              <select
                {...register("actualRole")}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">— ללא —</option>
                {actualRoleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">סקטור</label>
            <Controller
              control={control}
              name="sector"
              render={({ field }) => (
                <select
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  className="w-full max-w-[50%] rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="">— ללא —</option>
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
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

          {activeError && <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">{activeError}</p>}

          {!readOnly && (
            <div className="flex items-center justify-between gap-2">
              {employee ? (
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={setActiveMutation.isPending}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                    employeeActive
                      ? "border-brand-red text-brand-red hover:bg-brand-red-soft"
                      : "border-brand-green text-brand-green hover:bg-brand-green-soft"
                  }`}
                >
                  {setActiveMutation.isPending ? "מעדכן..." : employeeActive ? "סמן/י כעזב/ה (לא פעיל/ה)" : "החזר/י לפעיל/ה"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
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
            </div>
          )}
        </form>
      </fieldset>
    </Modal>
  );
}
