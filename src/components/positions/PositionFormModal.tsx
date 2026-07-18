"use client";

import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { positionFormSchema, type Position, type PositionFormValues } from "@/lib/schemas/position";
import type { Unit } from "@/lib/schemas/unit";
import {
  useCreatePositionMutation,
  useUpdatePositionMutation,
} from "@/lib/queries/usePositions";

const FUNDING_SOURCE_OPTIONS = ["מדינה", "קרן", "מחקר", "תרומה", "אחר"] as const;

function toPercentInputValue(v: number | null) {
  return v !== null ? String(Math.round(v * 1000) / 10) : "";
}

function toDateInputValue(ts: number | null) {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

export function PositionFormModal({
  position,
  units,
  onClose,
  readOnly = false,
  hasActiveAssignment = false,
  prefill,
}: {
  position: Position | null;
  units: Unit[];
  onClose: () => void;
  readOnly?: boolean;
  /** Whether this position currently has an active Assignment — while true, status must
   * stay מאויש and can only change via the end/transfer assignment actions. */
  hasActiveAssignment?: boolean;
  /** Pre-fills a subset of fields for a brand-new position (e.g. unit + budget item, when
   * adding another slot under a budget line that already has room left). Ignored when editing
   * an existing position. */
  prefill?: Partial<PositionFormValues>;
}) {
  const createMutation = useCreatePositionMutation();
  const updateMutation = useUpdatePositionMutation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: position
      ? { ...position, frozenUntil: position.frozenUntil ?? null, budgetComponents: position.budgetComponents ?? [] }
      : {
          fundingSource: "מדינה",
          unitId: null,
          budgetItemId: null,
          budgetItemRaw: null,
          employmentPercent: null,
          role: null,
          budgetComponents: [],
          status: "פנוי",
          frozenUntil: null,
          source: "ידני",
          notes: "",
          ...prefill,
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "budgetComponents" });

  async function onSubmit(values: PositionFormValues) {
    if (position) {
      await updateMutation.mutateAsync({ id: position.id, before: position, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    onClose();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;
  const watchedStatus = useWatch({ control, name: "status" });
  const watchedPercent = useWatch({ control, name: "employmentPercent" });
  const watchedComponents = useWatch({ control, name: "budgetComponents" }) ?? [];
  const componentsTotal = watchedComponents.reduce((sum, c) => sum + (c?.percent ?? 0), 0);
  const totalMismatch =
    watchedComponents.length > 0 && watchedPercent !== null && Math.abs(componentsTotal - watchedPercent) > 0.005;

  return (
    <Modal title={position ? "עריכת תקן" : "הוספת תקן"} onClose={onClose} wide>
      <fieldset disabled={readOnly} className="contents">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">תפקיד</label>
            <input
              {...register("role")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            {errors.role && <p className="mt-1 text-xs text-brand-red">{errors.role.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">יחידה / מחלקה</label>
            <select
              {...register("unitId")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">— ללא —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">אחוז תקן (%)</label>
            <Controller
              control={control}
              name="employmentPercent"
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={toPercentInputValue(field.value)}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value) / 100)
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">סטטוס</label>
            <select
              {...register("status")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
            >
              {hasActiveAssignment ? (
                <>
                  <option value="מאויש">מאויש</option>
                  <option value="מוקפא">מוקפא (למשל חופשת לידה — העובד/ת נשאר/ת משויך/ת)</option>
                </>
              ) : (
                <>
                  <option value="פנוי">פנוי</option>
                  <option value="מוקפא">מוקפא</option>
                  <option value="בביטול">בביטול</option>
                </>
              )}
            </select>
            {hasActiveAssignment && (
              <p className="mt-1 text-xs text-foreground-subtle">
                כדי לפנות או לבטל את התקן לגמרי יש לסיים או להעביר את השיבוץ הקיים קודם. &quot;מוקפא&quot;
                שומר את השיבוץ הקיים — מתאים לחופשת לידה/מחלה ממושכת שבהם התקן עדיין שייך לעובד/ת.
              </p>
            )}
          </div>

          {watchedStatus === "מוקפא" && (
            <div>
              <label className="mb-1 block text-sm font-medium">מוקפא עד תאריך</label>
              <Controller
                control={control}
                name="frozenUntil"
                render={({ field }) => (
                  <input
                    type="date"
                    value={toDateInputValue(field.value)}
                    onChange={(e) =>
                      field.onChange(e.target.value ? new Date(e.target.value).getTime() : null)
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                )}
              />
              <p className="mt-1 text-xs text-foreground-subtle">
                תאריך משוער לחזרה / הפשרת התקן — לא חובה
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium">רכיבי תקציב</label>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => append({ fundingSource: "מדינה", budgetNumber: "", percent: 0, notes: "" })}
                  className="flex items-center gap-1 rounded-lg border border-brand-blue px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-brand-blue-soft"
                >
                  <Plus size={14} />
                  הוסף רכיב תקציב
                </button>
              )}
            </div>
            {fields.length === 0 ? (
              <p className="text-xs text-foreground-subtle">
                אין עדיין רכיבי תקציב — אפשר להוסיף כמה שצריך, כל אחד עם מקור, מספר תקציב ואחוז משלו.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 items-start gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_100px_1fr_auto]"
                  >
                    <select
                      {...register(`budgetComponents.${index}.fundingSource` as const)}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    >
                      {FUNDING_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <input
                      {...register(`budgetComponents.${index}.budgetNumber` as const)}
                      placeholder="מספר תקציב"
                      dir="ltr"
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <Controller
                      control={control}
                      name={`budgetComponents.${index}.percent` as const}
                      render={({ field: percentField }) => (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          placeholder="אחוז"
                          value={toPercentInputValue(percentField.value)}
                          onChange={(e) =>
                            percentField.onChange(e.target.value === "" ? 0 : Number(e.target.value) / 100)
                          }
                          onBlur={percentField.onBlur}
                          name={percentField.name}
                          className="rounded-lg border border-border px-2 py-1.5 text-sm"
                        />
                      )}
                    />
                    <input
                      {...register(`budgetComponents.${index}.notes` as const)}
                      placeholder="הערות"
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label="הסרת רכיב"
                        title="הסרת רכיב"
                        className="justify-self-center rounded-lg p-1.5 text-foreground-subtle hover:bg-brand-red-soft hover:text-brand-red"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <p className={`text-xs ${totalMismatch ? "text-brand-red" : "text-foreground-subtle"}`}>
                  סה&quot;כ רכיבים: {Math.round(componentsTotal * 1000) / 10}%
                  {watchedPercent !== null && (
                    <>
                      {" "}
                      מתוך {Math.round(watchedPercent * 1000) / 10}% אחוז תקן
                      {totalMismatch ? " — לא תואם" : " — תואם"}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">הערות</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          {!readOnly && (
            <div className="sm:col-span-2 flex justify-end gap-2">
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
