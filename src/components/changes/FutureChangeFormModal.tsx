"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import {
  futureChangeFormSchema,
  type FutureChange,
  type FutureChangeFormValues,
} from "@/lib/schemas/futureChange";
import {
  useCreateFutureChangeMutation,
  useUpdateFutureChangeMutation,
} from "@/lib/queries/useFutureChanges";
import type { Position } from "@/lib/schemas/position";
import type { Unit } from "@/lib/schemas/unit";

function toDateInputValue(ts: number | null) {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

function toPercentInputValue(v: number | null) {
  return v !== null ? String(Math.round(v * 100)) : "";
}

export function FutureChangeFormModal({
  change,
  positions,
  units,
  onClose,
  readOnly = false,
}: {
  change: FutureChange | null;
  positions: Position[];
  units: Unit[];
  onClose: () => void;
  readOnly?: boolean;
}) {
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const createMutation = useCreateFutureChangeMutation();
  const updateMutation = useUpdateFutureChangeMutation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FutureChangeFormValues>({
    resolver: zodResolver(futureChangeFormSchema),
    defaultValues: change
      ? { ...change }
      : {
          firstName: "",
          lastName: "",
          employmentPercent: null,
          effectiveDate: null,
          effectiveDateText: null,
          fundingSource: null,
          positionRef: null,
          changeType: "קליטה",
          status: "מתוכנן",
          relatedPositionId: null,
          notes: "",
        },
  });

  async function onSubmit(values: FutureChangeFormValues) {
    if (change) {
      await updateMutation.mutateAsync({ id: change.id, before: change, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    onClose();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal title={change ? "עריכת שינוי עתידי" : "הוספת שינוי עתידי"} onClose={onClose} wide>
      <fieldset disabled={readOnly} className="contents">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">שם פרטי</label>
            <input
              {...register("firstName")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-brand-red">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">שם משפחה</label>
            <input
              {...register("lastName")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-brand-red">{errors.lastName.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">סוג שינוי</label>
            <select
              {...register("changeType")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="עזיבה">עזיבה</option>
              <option value="קליטה">קליטה</option>
              <option value="שינוי אחוזי משרה">שינוי אחוזי משרה</option>
              <option value="מעבר תקן">מעבר תקן</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">סטטוס</label>
            <select
              {...register("status")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="מתוכנן">מתוכנן</option>
              <option value="בטיפול">בטיפול</option>
              <option value="בוצע">בוצע</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">אחוזי משרה (%)</label>
            <Controller
              control={control}
              name="employmentPercent"
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  max={100}
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
            <label className="mb-1 block text-sm font-medium">מתאריך</label>
            <Controller
              control={control}
              name="effectiveDate"
              render={({ field }) => (
                <input
                  type="date"
                  value={toDateInputValue(field.value)}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : new Date(e.target.value).getTime())
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">מדינה / קרן</label>
            <select
              {...register("fundingSource")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">— לא ידוע —</option>
              <option value="מדינה">מדינה</option>
              <option value="קרן">קרן</option>
              <option value="אחר">אחר</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">מס&apos; תקן / סעיף תקציב</label>
            <input
              {...register("positionRef")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">תקן משויך (רשות)</label>
            <select
              {...register("relatedPositionId")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">— ללא —</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.role ?? "תקן ללא תפקיד"}
                  {p.unitId ? ` — ${unitNameById.get(p.unitId) ?? ""}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-foreground-subtle">
              קישור לתקן ספציפי גורם לשינוי הזה להופיע גם במסך &quot;יחידות ומחלקות&quot; תחת
              &quot;שינויים צפויים&quot;.
            </p>
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
