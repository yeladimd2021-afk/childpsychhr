"use client";

import { Modal } from "@/components/ui/Modal";
import { useEntityHistoryQuery } from "@/lib/queries/useAuditLog";
import type { EntityType } from "@/lib/schemas/auditLog";
import { ACTION_LABELS, formatFieldLabel, formatFieldValue } from "@/lib/domain/auditFieldLabels";

export function HistoryModal({
  entityType,
  entityId,
  entityLabel,
  onClose,
}: {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  onClose: () => void;
}) {
  const { data: entries = [], isLoading } = useEntityHistoryQuery(entityType, entityId);

  return (
    <Modal title={`היסטוריית שינויים — ${entityLabel}`} onClose={onClose} wide>
      {isLoading && <p className="text-sm text-foreground-subtle">טוען...</p>}
      {!isLoading && entries.length === 0 && (
        <p className="text-sm text-foreground-subtle">אין עדיין שינויים רשומים.</p>
      )}
      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-foreground-subtle">
              <span>
                {entry.changedByName} · {ACTION_LABELS[entry.action] ?? entry.action}
              </span>
              <span>{new Date(entry.changedAt).toLocaleString("he-IL")}</span>
            </div>
            {entry.changes.length > 0 && (
              <ul className="flex flex-col gap-1">
                {entry.changes.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium">{formatFieldLabel(c.field, entityType)}</span>:{" "}
                    {formatFieldValue(c.field, c.oldValue)} ← {formatFieldValue(c.field, c.newValue)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
