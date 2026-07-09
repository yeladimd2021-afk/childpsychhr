import { z } from "zod";

export const vacancyReviewStatusSchema = z.enum(["לבדיקה", "בתהליך", "אושר", "הסתיים"]);
export type VacancyReviewStatusValue = z.infer<typeof vacancyReviewStatusSchema>;

/** One doc per BudgetItem — tracks the manual review workflow for its vacant quota. */
export const vacancyReviewSchema = z.object({
  id: z.string(),
  budgetItemId: z.string(),
  status: vacancyReviewStatusSchema,
  notes: z.string().optional(),
  updatedAt: z.number(),
  updatedBy: z.string(),
});
export type VacancyReview = z.infer<typeof vacancyReviewSchema>;
