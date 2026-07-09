"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canManageUsers } from "@/lib/auth/permissions";
import { useAuditLogQuery } from "@/lib/queries/useAuditLog";
import type { EntityType } from "@/lib/schemas/auditLog";

const ENTITY_LABELS: Record<EntityType, string> = {
  position: "תקן",
  employee: "עובד",
  assignment: "שיבוץ",
  unit: "יחידה",
  budgetItem: "סעיף תקציב",
  futureChange: "שינוי עתידי",
  user: "משתמש",
  systemSettings: "הגדרות מערכת",
};

const ACTION_LABELS: Record<string, string> = {
  create: "נוצר",
  update: "עודכן",
  "delete-status": "שונה סטטוס",
  import: "יובא מאקסל",
};

function formatValue(v: string | number | boolean | null) {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  return String(v);
}

export default function AuditPage() {
  const { profile } = useAuth();
  const { data: entries = [], isLoading } = useAuditLogQuery();
  const [entityFilter, setEntityFilter] = useState<EntityType | "">("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    let result = entries;
    if (entityFilter) result = result.filter((e) => e.entityType === entityFilter);
    if (search.trim()) {
      const q = search.trim();
      result = result.filter((e) => e.entityLabel.includes(q) || e.changedByName.includes(q));
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
      result = result.filter((e) => e.changedAt >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
      result = result.filter((e) => e.changedAt <= toTs);
    }
    return result;
  }, [entries, entityFilter, search, dateFrom, dateTo]);

  if (!canManageUsers(profile?.role)) {
    return (
      <div className="p-8 text-sm text-foreground-subtle">
        יומן השינויים המלא זמין למנהלי מערכת בלבד. ניתן לראות היסטוריה לפי רשומה במסכי העובדים,
        היחידות והשינויים.
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">יומן שינויים</h1>
        <p className="mt-1 text-sm text-foreground-subtle">200 השינויים האחרונים במערכת</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "",
                "position",
                "employee",
                "assignment",
                "unit",
                "budgetItem",
                "futureChange",
                "user",
                "systemSettings",
              ] as const
            ).map((t) => (
              <button
                key={t}
                onClick={() => setEntityFilter(t)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  entityFilter === t
                    ? "bg-brand-blue text-white"
                    : "bg-background text-foreground-subtle hover:bg-brand-blue-soft"
                }`}
              >
                {t ? ENTITY_LABELS[t] : "הכל"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="חיפוש לפי שם רשומה או שם מבצע השינוי"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[220px] flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-foreground-subtle">מתאריך</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-foreground-subtle">עד תאריך</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            {(search || dateFrom || dateTo || entityFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                  setEntityFilter("");
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-brand-blue hover:underline"
              >
                נקה סינון
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          {filtered.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-subtle">
                <span className="flex items-center gap-2">
                  <Badge tone="blue">{ENTITY_LABELS[entry.entityType]}</Badge>
                  <span className="font-medium text-foreground">{entry.entityLabel}</span>
                  <span>
                    {entry.changedByName} · {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                </span>
                <span>{new Date(entry.changedAt).toLocaleString("he-IL")}</span>
              </div>
              {entry.changes.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {entry.changes.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium">{c.field}</span>: {formatValue(c.oldValue)} ←{" "}
                      {formatValue(c.newValue)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-foreground-subtle">אין עדיין רשומות ביומן.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
