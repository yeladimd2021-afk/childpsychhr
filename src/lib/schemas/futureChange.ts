import { z } from "zod";
import { fundingSourceSchema } from "./position";

export const changeTypeSchema = z.enum(["עזיבה", "קליטה", "שינוי אחוזי משרה", "מעבר תקן"]);
export type ChangeType = z.infer<typeof changeTypeSchema>;

export const changeStatusSchema = z.enum(["מתוכנן", "בטיפול", "בוצע"]);
export type ChangeStatus = z.infer<typeof changeStatusSchema>;

export const futureChangeSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employmentPercent: z.number().min(0).max(1).nullable(),
  effectiveDate: z.number().nullable(),
  effectiveDateText: z.string().nullable(),
  fundingSource: fundingSourceSchema.nullable(),
  positionRef: z.string().nullable(),
  changeType: changeTypeSchema,
  status: changeStatusSchema,
  relatedPositionId: z.string().nullable(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type FutureChange = z.infer<typeof futureChangeSchema>;

export const futureChangeFormSchema = futureChangeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FutureChangeFormValues = z.infer<typeof futureChangeFormSchema>;
