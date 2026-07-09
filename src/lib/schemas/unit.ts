import { z } from "zod";

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

/** Budget line within a unit (סעיף תקציב) — carries the allocated quota for that line. */
export const budgetItemSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  code: z.string().min(1),
  label: z.string().min(1),
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
