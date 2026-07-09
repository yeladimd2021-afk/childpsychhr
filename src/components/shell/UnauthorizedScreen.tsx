"use client";

import { useAuth } from "@/lib/auth/AuthContext";

export function UnauthorizedScreen({
  reason,
}: {
  reason: "no-profile" | "inactive" | "load-error";
}) {
  const { signOutUser, loadError } = useAuth();

  const messages: Record<typeof reason, string> = {
    "no-profile": "המשתמש שלך לא מוגדר עדיין במערכת. פנה/י למנהל המערכת כדי לקבל הרשאה.",
    inactive: "המשתמש שלך הושבת. פנה/י למנהל המערכת.",
    "load-error": "אירעה שגיאה בטעינת פרטי המשתמש.",
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="max-w-sm text-sm text-foreground-subtle">{messages[reason]}</p>
      {reason === "load-error" && loadError && (
        <code dir="ltr" className="max-w-md break-all rounded-lg bg-brand-red-soft px-3 py-2 text-xs text-brand-red">
          {loadError}
        </code>
      )}
      <button
        onClick={() => signOutUser()}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-brand-blue-soft"
      >
        התנתקות
      </button>
    </div>
  );
}
