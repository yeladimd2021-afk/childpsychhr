import { z } from "zod";
import { fundingSourceSchema } from "./position";

export const unitSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  notes: z.string().optional(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Unit = z.infer<typeof unitSchema>;

export const unitFormSchema = unitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UnitFormValues = z.infer<typeof unitFormSchema>;

/** Budget line within a unit (סעיף תקציב) — the central entity employees are assigned to
 * directly (see Assignment.budgetItemId). Carries the approved quota for that line; how much
 * of it is actually filled is derived from active assignments, not stored here. */
export const budgetItemSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  code: z.string().min(1),
  label: z.string().min(1),
  fundingSource: fundingSourceSchema,
  allocatedQuota: z.number(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type BudgetItem = z.infer<typeof budgetItemSchema>;

export const budgetItemFormSchema = budgetItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BudgetItemFormValues = z.infer<typeof budgetItemFormSchema>;
