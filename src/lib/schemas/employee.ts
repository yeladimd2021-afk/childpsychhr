import { z } from "zod";
import { positionSourceSchema } from "./position";

export const employeeSectorSchema = z.enum(["רופאים", "מנהל ומשק", "פרא-מקצועות הבריאות"]);
export type EmployeeSector = z.infer<typeof employeeSectorSchema>;

/** Fixed vocabulary for an employee's role ("תפקיד") — offered as a dropdown in the form, but the field
 * itself stays a plain string (not this enum) since real historical data already has values
 * that don't exactly match this list; tightening it to an enum would fail to load those. */
export const ACTUAL_ROLE_OPTIONS = [
  "פסיכיאטר/ית",
  "פסיכיאטר/ית - מנהל אגף",
  "פסיכיאטר/ית - מנהל מרפאה",
  "פסיכיאטר/ית - מנהל מחלקה",
  "פסיכיאטר/ית - מתמחה",
  "פסיכיאטר/ית - סגן",
  "פסיכולוג/ית",
  "מרפאה בעיסוק",
  "מנתחת התנהגות",
  "עוזר/ת מחקר",
  "מטפל/ת באומנות",
  "מזכירה",
  "דיאטן/ית",
  "טיפול במוסיקה",
  "עובד/ת סוציאלי/ת",
  "טיפול משפחתי",
  "לקויות למידה",
  "קלינאות תקשורת",
  "פיזיותרפיה",
  "ריפוי בהבעה ויצירה",
  "טיפול בתנועה ובמוסיקה",
  "מלווה אישית משפחתית",
  "מדריכ/ה חברתי/ת",
  "פסיכולוג/ית רפואי/ת",
] as const;

/** A person, independent of any specific position — the same employee can move between
 * positions over time via Assignment records without losing their identity/history. */
export const employeeSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  /** Israeli ID, kept as zero-padded text so leading zeros survive. Null when unknown. */
  idNumber: z.string().nullable(),
  phone: z.string().nullable(),
  /** Where the person actually works day-to-day and what they actually do there — kept
   * separate from the Position's own unitId/role, since a position's formal budget line can
   * sit under a different department than where its holder is practically stationed. */
  actualUnitId: z.string().nullable(),
  actualRole: z.string().nullable(),
  /** Professional division — independent of actualUnitId (a department like "אגף" can contain
   * people from more than one sector). */
  sector: employeeSectorSchema.nullable(),
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
