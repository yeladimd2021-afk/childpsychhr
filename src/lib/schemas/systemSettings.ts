import { z } from "zod";

/** Singleton doc (fixed id) so the Control Center's thresholds are data, not hardcoded
 * constants — an admin can retune them without a code change. */
export const SYSTEM_SETTINGS_ID = "default";

export const systemSettingsSchema = z.object({
  id: z.string(),
  /** Days a position has sat פנוי before it's flagged — feeds both the action queue's
   * severity color and the vacancy-age alerts. */
  vacancyThresholds: z.object({
    yellowDays: z.number().min(1),
    orangeDays: z.number().min(1),
    redDays: z.number().min(1),
  }),
  /** Days-until-effective windows for upcoming departures/joins/transfers in the workforce
   * timeline and action queue. */
  leavingWindows: z.object({
    criticalDays: z.number().min(1),
    urgentDays: z.number().min(1),
    planningDays: z.number().min(1),
  }),
  updatedAt: z.number(),
});
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const systemSettingsFormSchema = systemSettingsSchema.omit({ id: true, updatedAt: true });
export type SystemSettingsFormValues = z.infer<typeof systemSettingsFormSchema>;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsFormValues = {
  vacancyThresholds: { yellowDays: 30, orangeDays: 60, redDays: 90 },
  leavingWindows: { criticalDays: 14, urgentDays: 30, planningDays: 90 },
};
