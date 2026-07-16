import type { EntityType } from "@/lib/schemas/auditLog";

/** Shared vocabulary for rendering audit-log entries (global "יומן שינויים" page and the
 * per-record HistoryModal) in terms a non-technical manager can actually read — raw field keys
 * and unlabeled numbers are meaningless to someone who doesn't know the code. */

export const ACTION_LABELS: Record<string, string> = {
  create: "נוצר",
  update: "עודכן",
  delete: "נמחק",
  "delete-status": "שונה סטטוס",
  import: "יובא מאקסל",
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  position: "תקן",
  employee: "עובד",
  assignment: "שיבוץ",
  unit: "יחידה",
  budgetItem: "סעיף תקציב",
  futureChange: "שינוי עתידי",
  user: "משתמש",
  systemSettings: "הגדרות מערכת",
};

/** Every field name that ever appears in a diffFields() changes array, across every entity
 * type — position/employee/assignment/unit/budgetItem/futureChange/user/systemSettings. */
export const FIELD_LABELS: Record<string, string> = {
  fundingSource: "מקור תקציבי",
  unitId: "יחידה",
  budgetItemId: "סעיף תקציב",
  budgetItemRaw: "סעיף תקציב (מקורי)",
  employmentPercent: "אחוז משרה",
  role: "תפקיד",
  status: "סטטוס",
  frozenUntil: "מוקפא עד תאריך",
  source: "מקור רישום",
  notes: "הערות",
  firstName: "שם פרטי",
  lastName: "שם משפחה",
  idNumber: "תעודת זהות",
  phone: "טלפון",
  actualUnitId: "מחלקה בפועל",
  actualRole: "תפקיד בפועל",
  name: "שם",
  order: "סדר תצוגה",
  code: "קוד",
  label: "תיאור",
  allocatedQuota: "תקן מוקצה",
  effectiveDate: "תאריך כניסה לתוקף",
  effectiveDateText: "תאריך כניסה לתוקף (טקסט)",
  positionRef: "מס' תקן / סעיף תקציב",
  changeType: "סוג שינוי",
  relatedPositionId: "תקן משויך",
  startDate: "תאריך התחלה",
  startDateText: "תאריך התחלה (טקסט)",
  endDate: "תאריך סיום",
  active: "פעיל",
  email: "דוא\"ל",
  displayName: "שם מלא",
  yellowDays: "סף צהוב (ימים)",
  orangeDays: "סף כתום (ימים)",
  redDays: "סף אדום (ימים)",
  criticalDays: "חלון קריטי (ימים)",
  urgentDays: "חלון דחוף (ימים)",
  planningDays: "חלון תכנון (ימים)",
};

/** Fields whose stored value is a 0–1 fraction meant to be read as a percentage. */
const PERCENT_FIELDS = new Set(["employmentPercent"]);

/** Fields whose stored value is an epoch-ms timestamp meant to be read as a date. */
const DATE_FIELDS = new Set(["effectiveDate", "startDate", "endDate", "frozenUntil"]);

/** A handful of field keys mean something different depending on which entity they belong to
 * (e.g. "role" is a job title on a Position but a permission level — admin/editor/viewer — on a
 * User) — override the generic FIELD_LABELS lookup for those specific (entityType, field) pairs. */
const ENTITY_FIELD_LABEL_OVERRIDES: Partial<Record<EntityType, Record<string, string>>> = {
  user: { role: "הרשאה" },
};

export function formatFieldLabel(field: string, entityType?: EntityType): string {
  const override = entityType ? ENTITY_FIELD_LABEL_OVERRIDES[entityType]?.[field] : undefined;
  return override ?? FIELD_LABELS[field] ?? field;
}

export function formatFieldValue(field: string, value: string | number | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (typeof value === "number") {
    if (PERCENT_FIELDS.has(field)) return `${Math.round(value * 100)}%`;
    if (DATE_FIELDS.has(field)) return new Date(value).toLocaleDateString("he-IL");
  }
  return String(value);
}
