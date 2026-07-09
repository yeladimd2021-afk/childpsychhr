"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/AuthContext";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  useSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
} from "@/lib/queries/useSystemSettings";
import {
  systemSettingsFormSchema,
  type SystemSettingsFormValues,
} from "@/lib/schemas/systemSettings";

function NumberField({
  label,
  register,
  name,
  error,
}: {
  label: string;
  register: ReturnType<typeof useForm<SystemSettingsFormValues>>["register"];
  name:
    | "vacancyThresholds.yellowDays"
    | "vacancyThresholds.orangeDays"
    | "vacancyThresholds.redDays"
    | "leavingWindows.criticalDays"
    | "leavingWindows.urgentDays"
    | "leavingWindows.planningDays";
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="number"
        min={1}
        {...register(name, { valueAsNumber: true })}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { profile } = useAuth();
  const { data: settings, isLoading } = useSystemSettingsQuery();
  const updateMutation = useUpdateSystemSettingsMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(systemSettingsFormSchema),
  });

  useEffect(() => {
    if (settings) reset({ vacancyThresholds: settings.vacancyThresholds, leavingWindows: settings.leavingWindows });
  }, [settings, reset]);

  if (!canManageUsers(profile?.role)) {
    return (
      <div className="p-8 text-sm text-foreground-subtle">
        מסך הגדרות המערכת זמין למנהלי מערכת בלבד.
      </div>
    );
  }

  if (isLoading || !settings) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  async function onSubmit(values: SystemSettingsFormValues) {
    await updateMutation.mutateAsync({ before: settings!, values });
  }

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">הגדרות מערכת</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          הסף לפיהם מרכז השליטה הניהולי מסמן תקנים פנויים ושינויי כוח אדם כדחופים
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-1 font-medium">סף התיישנות תקן פנוי (ימים)</h2>
          <p className="mb-4 text-xs text-foreground-subtle">
            כמה ימים תקן יכול להישאר פנוי לפני שהוא מסומן כדורש תשומת לב, עדיפות גבוהה, או קריטי
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label="דורש תשומת לב (צהוב)"
              register={register}
              name="vacancyThresholds.yellowDays"
              error={errors.vacancyThresholds?.yellowDays?.message}
            />
            <NumberField
              label="עדיפות גבוהה (כתום)"
              register={register}
              name="vacancyThresholds.orangeDays"
              error={errors.vacancyThresholds?.orangeDays?.message}
            />
            <NumberField
              label="קריטי (אדום)"
              register={register}
              name="vacancyThresholds.redDays"
              error={errors.vacancyThresholds?.redDays?.message}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">חלונות זמן לשינויי כוח אדם קרובים (ימים)</h2>
          <p className="mb-4 text-xs text-foreground-subtle">
            כמה ימים לפני מועד השינוי הוא נכנס לתכנון, נחשב דחוף, או קריטי
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label="קריטי"
              register={register}
              name="leavingWindows.criticalDays"
              error={errors.leavingWindows?.criticalDays?.message}
            />
            <NumberField
              label="דחוף"
              register={register}
              name="leavingWindows.urgentDays"
              error={errors.leavingWindows?.urgentDays?.message}
            />
            <NumberField
              label="תכנון תפעולי"
              register={register}
              name="leavingWindows.planningDays"
              error={errors.leavingWindows?.planningDays?.message}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={!isDirty || updateMutation.isPending}
            className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            {updateMutation.isPending ? "שומר..." : "שמירה"}
          </button>
        </div>
      </form>
    </div>
  );
}
