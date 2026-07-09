"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth/AuthContext";
import { canManageUsers, ROLE_LABELS } from "@/lib/auth/permissions";
import { useSetUserActiveMutation, useSetUserRoleMutation, useUsersQuery } from "@/lib/queries/useUsers";
import { createUserAccount } from "@/lib/firebase/createUser";
import { recordHistoryEntry } from "@/lib/firebase/history";
import type { UserRole } from "@/lib/schemas/user";

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const newUid = await createUserAccount({ email, password, displayName, role });
      await recordHistoryEntry({
        entityType: "user",
        entityId: newUid,
        entityLabel: displayName,
        action: "create",
        changes: [],
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    } catch {
      setError("שגיאה ביצירת המשתמש — ייתכן שהדוא\"ל כבר קיים או שהסיסמה קצרה מדי");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="הוספת משתמש" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">שם מלא</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">דוא&quot;ל</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">סיסמה זמנית</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">הרשאה</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="viewer">צפייה בלבד</option>
            <option value="editor">עורך</option>
            <option value="admin">מנהל מערכת</option>
          </select>
        </div>
        {error && <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "יוצר..." : "יצירה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { profile } = useAuth();
  const { data: users = [], isLoading } = useUsersQuery();
  const setRole = useSetUserRoleMutation();
  const setActive = useSetUserActiveMutation();
  const [showCreate, setShowCreate] = useState(false);

  if (!canManageUsers(profile?.role)) {
    return <div className="p-8 text-sm text-foreground-subtle">מסך זה זמין למנהלי מערכת בלבד.</div>;
  }

  if (isLoading) return <div className="p-8 text-sm text-foreground-subtle">טוען...</div>;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ניהול משתמשים</h1>
          <p className="mt-1 text-sm text-foreground-subtle">{users.length} משתמשים</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          <Plus size={16} />
          הוספת משתמש
        </button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs text-foreground-subtle">
            <tr>
              <th className="px-3 py-3 text-right">שם</th>
              <th className="px-3 py-3 text-right">דוא&quot;ל</th>
              <th className="px-3 py-3 text-right">הרשאה</th>
              <th className="px-3 py-3 text-right">סטטוס</th>
              <th className="px-3 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-t border-border">
                <td className="px-3 py-3 font-medium">{u.displayName}</td>
                <td dir="ltr" className="px-3 py-3 text-left">
                  {u.email}
                </td>
                <td className="px-3 py-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      setRole.mutate({ before: u, role: e.target.value as UserRole })
                    }
                    disabled={u.uid === profile?.uid}
                    className="rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    <option value="viewer">{ROLE_LABELS.viewer}</option>
                    <option value="editor">{ROLE_LABELS.editor}</option>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={u.active ? "green" : "red"}>{u.active ? "פעיל" : "מושבת"}</Badge>
                </td>
                <td className="px-3 py-3">
                  {u.uid !== profile?.uid && (
                    <button
                      onClick={() => setActive.mutate({ before: u, active: !u.active })}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      {u.active ? "השבתה" : "הפעלה"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
