import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listDocs, setDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import {
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_SETTINGS_ID,
  type SystemSettings,
  type SystemSettingsFormValues,
} from "@/lib/schemas/systemSettings";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "systemSettings";

export function useSystemSettingsQuery() {
  return useQuery({
    queryKey: [COLLECTION],
    queryFn: async (): Promise<SystemSettings> => {
      const docs = await listDocs<SystemSettings>(COLLECTION);
      const existing = docs.find((d) => d.id === SYSTEM_SETTINGS_ID);
      if (existing) return existing;
      // First run: no settings doc yet — seed it with the defaults so callers never have to
      // special-case "missing settings," and so the defaults are visible/editable right away.
      const seeded: SystemSettings = {
        id: SYSTEM_SETTINGS_ID,
        ...DEFAULT_SYSTEM_SETTINGS,
        updatedAt: Date.now(),
      };
      await setDocById(COLLECTION, SYSTEM_SETTINGS_ID, seeded);
      return seeded;
    },
  });
}

export function useUpdateSystemSettingsMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      before,
      values,
    }: {
      before: SystemSettings;
      values: SystemSettingsFormValues;
    }) => {
      const updatedAt = Date.now();
      const next: SystemSettings = { id: SYSTEM_SETTINGS_ID, ...values, updatedAt };
      await setDocById(COLLECTION, SYSTEM_SETTINGS_ID, next);
      const changes = diffFields(
        {
          yellowDays: before.vacancyThresholds.yellowDays,
          orangeDays: before.vacancyThresholds.orangeDays,
          redDays: before.vacancyThresholds.redDays,
          criticalDays: before.leavingWindows.criticalDays,
          urgentDays: before.leavingWindows.urgentDays,
          planningDays: before.leavingWindows.planningDays,
        },
        {
          yellowDays: values.vacancyThresholds.yellowDays,
          orangeDays: values.vacancyThresholds.orangeDays,
          redDays: values.vacancyThresholds.redDays,
          criticalDays: values.leavingWindows.criticalDays,
          urgentDays: values.leavingWindows.urgentDays,
          planningDays: values.leavingWindows.planningDays,
        }
      );
      await recordHistoryEntry({
        entityType: "systemSettings",
        entityId: SYSTEM_SETTINGS_ID,
        entityLabel: "הגדרות מערכת",
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}
