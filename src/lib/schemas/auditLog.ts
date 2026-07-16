import { z } from "zod";

export const entityTypeSchema = z.enum([
  "position",
  "employee",
  "assignment",
  "unit",
  "budgetItem",
  "futureChange",
  "user",
  "systemSettings",
]);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const fieldChangeSchema = z.object({
  field: z.string(),
  oldValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  newValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
export type FieldChange = z.infer<typeof fieldChangeSchema>;

export const auditLogEntrySchema = z.object({
  id: z.string(),
  entityType: entityTypeSchema,
  entityId: z.string(),
  entityLabel: z.string(),
  action: z.enum(["create", "update", "delete", "delete-status", "import"]),
  changes: z.array(fieldChangeSchema),
  changedBy: z.string(),
  changedByName: z.string(),
  changedAt: z.number(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
