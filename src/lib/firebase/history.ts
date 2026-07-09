import { createDoc } from "@/lib/data/dataClient";
import type { EntityType, FieldChange } from "@/lib/schemas/auditLog";

type Primitive = string | number | boolean | null;

/** Shallow diff between two flat records — used to populate audit log entries.
 * Only compares fields present in `after` (the submitted form values): `before` is the full
 * entity and carries fields like `id`/`createdAt` that no form ever submits, so unioning both
 * objects' keys would flag those as "changed to null" on every single edit. */
export function diffFields(
  before: Record<string, Primitive>,
  after: Record<string, Primitive>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(after)) {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;
    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }
  return changes;
}

export async function recordHistoryEntry(params: {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  action: "create" | "update" | "delete-status" | "import";
  changes: FieldChange[];
  changedBy: string;
  changedByName: string;
}) {
  if (params.changes.length === 0 && params.action === "update") return;
  await createDoc("auditLog", { ...params, changedAt: Date.now() });
}
