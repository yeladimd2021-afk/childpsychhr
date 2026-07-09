import { z } from "zod";
import { positionSourceSchema } from "./position";

/** A person, independent of any specific position — the same employee can move between
 * positions over time via Assignment records without losing their identity/history. */
export const employeeSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  /** Israeli ID, kept as zero-padded text so leading zeros survive. Null when unknown. */
  idNumber: z.string().nullable(),
  source: positionSourceSchema,
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const employeeFormSchema = employeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export function formatEmployeeName(e: { firstName: string; lastName: string } | null | undefined) {
  if (!e) return "(לא משויך)";
  return `${e.firstName} ${e.lastName}`;
}
