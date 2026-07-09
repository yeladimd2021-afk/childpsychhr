"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit } from "@/lib/auth/permissions";
import { useFutureChangesQuery } from "@/lib/queries/useFutureChanges";
import { FutureChangeFormModal } from "@/components/changes/FutureChangeFormModal";
import type { FutureChange } from "@/lib/schemas/futureChange";

const STATUS_TONE = {
  מתוכנן: "blue",
  בטיפול: "amber",
  בוצע: "green",
} as const;

const TYPE_TONE = {
  עזיבה: "red",
  קליטה: "green",
  "שינוי אחוזי משרה": "blue",
  "מעבר תקן": "turquoise",
} as const;

export default function ChangesPage() {
  const { profile } = useAuth();
  const editAllowed = canEdit(profile?.role);
  const { data: changes = [], isLoading } = useFutureChangesQuery();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<FutureChange | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      // One-time sync from the URL a quick action arrived with (Control Center), not a
      // response to external state changing over time.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCreateModal(true);
      router.replace("/changes");
    }
    // Only meant to run once, reading whatever query params the Control Center's quick
    // action arrived with — not meant to react to later changes in searchParams/router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let result = changes;
    if (typeFilter) result = result.filter((c) => c.changeType === typeFilter);
    if (statusFilter) result = result.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim();
      result = result.filter(
        (c) => `${c.firstName} ${c.lastName}`.includes(q) || (c.notes ?? "").includes(q)
      );
    }
    return result;
  }, [changes, typeFilter, statusFilter, search]);

  const timeline = useMemo(() => {
    const map = new Map<string, FutureChange[]>();
    for (const c of filtered) {
      if (!c.effectiveDate) continue;
      const d = new Date(c.effectiveDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const undated = filtered.filter((c) => !c.effectiveDate);

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">שינויים עתידיים</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            עזיבות, קליטות, שינויי אחוזי משרה ומעברי תקן
          </p>
        </div>
        {editAllowed && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            <Plus size={18} />
            הוסף שינוי עתידי
          </button>
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {["", "עזיבה", "קליטה", "שינוי אחוזי משרה", "מעבר תקן"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  typeFilter === t
                    ? "bg-brand-blue text-white"
                    : "bg-background text-foreground-subtle hover:bg-brand-blue-soft"
                }`}
              >
                {t || "הכל"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="חיפוש לפי שם או הערות"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">כל הסטטוסים</option>
              <option value="מתוכנן">מתוכנן</option>
              <option value="בטיפול">בטיפול</option>
              <option value="בוצע">בוצע</option>
            </select>
            {(search || statusFilter || typeFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setTypeFilter("");
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
        <h2 className="mb-4 font-medium">ציר זמן חודשי</h2>
        {timeline.length === 0 && (
          <p className="text-sm text-foreground-subtle">אין שינויים עתידיים עם תאריך.</p>
        )}
        <div className="flex flex-col gap-4">
          {timeline.map(([month, items]) => (
            <div key={month}>
              <p className="mb-2 text-sm font-semibold text-brand-blue">{month}</p>
              <div className="flex flex-col gap-2">
                {items.map((c) => (
                  <ChangeRow key={c.id} change={c} onEdit={() => setEditing(c)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {undated.length > 0 && (
        <Card>
          <h2 className="mb-4 font-medium">ללא תאריך</h2>
          <div className="flex flex-col gap-2">
            {undated.map((c) => (
              <ChangeRow key={c.id} change={c} onEdit={() => setEditing(c)} />
            ))}
          </div>
        </Card>
      )}

      {showCreateModal && (
        <FutureChangeFormModal change={null} onClose={() => setShowCreateModal(false)} />
      )}
      {editing && (
        <FutureChangeFormModal
          change={editing}
          onClose={() => setEditing(null)}
          readOnly={!editAllowed}
        />
      )}
    </div>
  );
}

function ChangeRow({ change, onEdit }: { change: FutureChange; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm">
      <div>
        <p className="font-medium">
          {change.firstName} {change.lastName}
        </p>
        <p className="text-xs text-foreground-subtle">
          {change.effectiveDateText ??
            (change.effectiveDate ? new Date(change.effectiveDate).toLocaleDateString("he-IL") : "")}
          {change.employmentPercent !== null &&
            ` · ${Math.round(change.employmentPercent * 100)}%`}
          {change.notes && ` · ${change.notes}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={TYPE_TONE[change.changeType]}>{change.changeType}</Badge>
        <Badge tone={STATUS_TONE[change.status]}>{change.status}</Badge>
        <button
          onClick={onEdit}
          aria-label="עריכה"
          className="rounded-lg p-1.5 text-foreground-subtle hover:bg-surface"
        >
          <Pencil size={16} />
        </button>
      </div>
    </div>
  );
}
