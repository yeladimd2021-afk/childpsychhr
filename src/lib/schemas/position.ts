import { z } from "zod";

export const fundingSourceSchema = z.enum(["מדינה", "קרן", "מחקר", "תרומה", "אחר"]);
export type FundingSource = z.infer<typeof fundingSourceSchema>;

/** One funding stream that makes up part of a position's own slot — a position can have any
 * number of these (e.g. 40% מדינה + 30% מחקר + 30% תרומה, summing toward its employmentPercent).
 * budgetNumber is free text, entered directly on the position — it is NOT a foreign key to a
 * BudgetItem record, so there is nothing to pre-create before adding a component. */
export const positionBudgetComponentSchema = z.object({
  fundingSource: fundingSourceSchema,
  budgetNumber: z.string(),
  percent: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type PositionBudgetComponent = z.infer<typeof positionBudgetComponentSchema>;

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
  /** Free-form funding breakdown of this position's own slot — replaces the single
   * fundingSource/budgetItemId pair as the primary way to record how a position is funded.
   * Positions migrated from before this existed have exactly one component mirroring their old
   * fundingSource/budgetItemRaw/employmentPercent (see scripts/migrate-budget-components.mjs).
   * Always an array (never null) — "no components entered yet" and "empty list" are the same
   * thing here, and callers must supply [] explicitly rather than relying on a schema default
   * (keeps the inferred type simple for react-hook-form). */
  budgetComponents: z.array(positionBudgetComponentSchema),
  status: positionStatusSchema,
  /** Expected return/thaw date for a מוקפא position (e.g. maternity leave) — meaningless for
   * any other status. Kept even after the position becomes active again, as history. */
  frozenUntil: z.number().nullable(),
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
