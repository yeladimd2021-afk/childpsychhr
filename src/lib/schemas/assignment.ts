import { z } from "zod";

/** Links an Employee to a Position for a span of time. A null endDate means it's the
 * position's current occupant; a closed (non-null endDate) assignment is history — this is
 * what lets us answer "who held this position over the years." */
export const assignmentSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  positionId: z.string(),
  startDate: z.number().nullable(),
  startDateText: z.string().nullable(),
  endDate: z.number().nullable(),
  /** How much of the position's slot this assignment covers — defaults to the full slot,
   * but can be less if a position is split between people. */
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
