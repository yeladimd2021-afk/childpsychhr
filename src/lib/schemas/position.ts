import { z } from "zod";

export const fundingSourceSchema = z.enum(["מדינה", "קרן", "אחר"]);
export type FundingSource = z.infer<typeof fundingSourceSchema>;

/** How a record entered the system — lets the dashboard show an accurate data-source indicator. */
export const positionSourceSchema = z.enum(["ידני", "ייבוא"]);
export type PositionSource = z.infer<typeof positionSourceSchema>;

/** A position is an independent budget slot, decoupled from whoever currently holds it —
 * who's assigned (if anyone) lives in the Assignment entity instead. */
export const positionStatusSchema = z.enum(["מאויש", "פנוי", "מוקפא", "בביטול"]);
export type PositionStatus = z.infer<typeof positionStatusSchema>;

export const positionSchema = z.object({
  id: z.string(),
  fundingSource: fundingSourceSchema,
  unitId: z.string().nullable(),
  /** Resolved budget line when the code matched a known BudgetItem. */
  budgetItemId: z.string().nullable(),
  /** Raw סעיף תקציב cell value, kept even when it doesn't resolve to a known code (e.g. "DELL", "מלגאית"). */
  budgetItemRaw: z.string().nullable(),
  /** Slot size — e.g. a 50% position. An assignment's own percent (see Assignment) can be
   * smaller when a slot is split, but defaults to filling this exactly. */
  employmentPercent: z.number().min(0).max(1).nullable(),
  role: z.string().nullable(),
  status: positionStatusSchema,
  source: positionSourceSchema,
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Position = z.infer<typeof positionSchema>;

export const positionFormSchema = positionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PositionFormValues = z.infer<typeof positionFormSchema>;
