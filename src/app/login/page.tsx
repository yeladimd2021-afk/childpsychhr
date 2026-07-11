"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { FirebaseError } from "firebase/app";
import { Logo } from "@/components/ui/Logo";
import { APP_DEPARTMENT, APP_NAME, APP_SUBTITLE } from "@/lib/branding";

function authErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
        return "מייל או סיסמה שגויים";
      case "auth/user-not-found":
        return "משתמש לא קיים";
      case "auth/wrong-password":
        return "סיסמה שגויה";
      case "auth/invalid-email":
        return "כתובת מייל לא תקינה";
      case "auth/api-key-not-valid":
        return "בעיה בהגדרות Firebase";
      case "auth/operation-not-allowed":
        return "התחברות באמצעות Email/Password לא מופעלת";
      case "auth/too-many-requests":
        return "יותר מדי ניסיונות התחברות — נסה/י שוב מאוחר יותר";
      default:
        return "אירעה שגיאה בהתחברות";
    }
  }
  return "אירעה שגיאה בהתחברות";
}

export default function LoginPage() {
  const { signIn, isDemoMode } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isDemoMode) router.replace("/");
  }, [isDemoMode, router]);

  if (isDemoMode) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      if (process.env.NODE_ENV === "development" && err instanceof FirebaseError) {
        console.error("Firebase auth error:", err.code, err.message);
      }
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <h1 dir="ltr" className="text-right text-xl font-bold text-brand-blue">{APP_NAME}</h1>
            <p className="text-sm text-foreground-subtle">{APP_SUBTITLE}</p>
            <p className="text-sm text-foreground-subtle">{APP_DEPARTMENT}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              דוא&quot;ל
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "מתחבר/ת..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}
