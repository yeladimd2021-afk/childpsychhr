import { z } from "zod";

/** Links an Employee to a BudgetItem (סעיף תקציב) for a span of time. A null endDate means
 * it's still active; a closed (non-null endDate) assignment is history — this is what lets us
 * answer "who was assigned here over the years." Kept as its own entity for history, but never
 * exposed to the user as a separate creation step — from the UI, you just "assign an employee"
 * straight from the budget item. */
export const assignmentSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  budgetItemId: z.string().nullable(),
  /** The role this assignment covers — lives here (not on a Position) since one budget item
   * can fund several different roles across different employees/assignments. */
  role: z.string().nullable(),
  /** Legacy link to the old Position entity — only ever set on assignments created before the
   * budget-item-centric model. Never set on new assignments; kept untouched on old ones. */
  positionId: z.string().nullable(),
  startDate: z.number().nullable(),
  startDateText: z.string().nullable(),
  endDate: z.number().nullable(),
  /** How much of the budget item's approved quota this assignment covers — defaults to the
   * full slot, but can be less if a budget item is split between people. */
  employmentPercent: z.number().min(0).max(1).nullable(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const assignmentFormSchema = assignmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

export function isActiveAssignment(a: Pick<Assignment, "endDate">) {
  return a.endDate === null;
}
