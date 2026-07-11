"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  DoorOpen,
  CalendarClock,
  Building2,
  History,
  Upload,
  UserCog,
  Settings,
  Menu,
  LogOut,
  BarChart3,
  DatabaseBackup,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit, canManageUsers, ROLE_LABELS } from "@/lib/auth/permissions";
import { Logo } from "@/components/ui/Logo";
import { APP_DEPARTMENT, APP_NAME, APP_SUBTITLE, APP_VERSION } from "@/lib/branding";

const NAV_ITEMS = [
  { href: "/", label: "מרכז שליטה ניהולי", icon: LayoutGrid },
  { href: "/positions", label: "עובדים ותקנים", icon: Users },
  { href: "/vacancies", label: "תקנים פנויים", icon: DoorOpen },
  { href: "/changes", label: "שינויים עתידיים", icon: CalendarClock },
  { href: "/units", label: "יחידות ומחלקות", icon: Building2 },
  { href: "/reports", label: "דוחות", icon: BarChart3 },
  { href: "/dashboard", label: "לוח מחוונים קלאסי", icon: LayoutDashboard },
  { href: "/audit", label: "יומן שינויים", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(true);
  const pathname = usePathname();
  const { profile, signOutUser, isDemoMode } = useAuth();

  useEffect(() => {
    // Default the menu closed on phone-width screens so the first thing a user sees is the
    // actual page, not 11 nav links they have to scroll past or discover a tiny close button
    // for — desktop keeps its open-by-default behavior untouched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(max-width: 767px)").matches) setMenuOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {menuOpen && (
        <aside className="fixed inset-0 z-40 flex flex-col overflow-y-auto border-l border-border bg-surface md:sticky md:inset-auto md:top-0 md:z-auto md:h-screen md:w-64">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Logo size={36} />
              <div className="min-w-0">
                <p dir="ltr" className="truncate text-right text-sm font-bold text-brand-blue">
                  {APP_NAME}
                </p>
                <p className="truncate text-xs text-foreground-subtle">{APP_SUBTITLE}</p>
                <p className="truncate text-xs text-foreground-subtle">{APP_DEPARTMENT}</p>
              </div>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="סגירת תפריט"
              className="shrink-0 rounded-lg p-1.5 hover:bg-brand-blue-soft"
            >
              <Menu size={18} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand-blue-soft text-brand-blue"
                      : "text-foreground-subtle hover:bg-background"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
            {canEdit(profile?.role) && (
              <Link
                href="/import"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname.startsWith("/import")
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "text-foreground-subtle hover:bg-background"
                }`}
              >
                <Upload size={18} />
                יבוא מאקסל
              </Link>
            )}
            {canManageUsers(profile?.role) && (
              <Link
                href="/users"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname.startsWith("/users")
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "text-foreground-subtle hover:bg-background"
                }`}
              >
                <UserCog size={18} />
                ניהול משתמשים
              </Link>
            )}
            {canManageUsers(profile?.role) && (
              <Link
                href="/settings"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname.startsWith("/settings")
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "text-foreground-subtle hover:bg-background"
                }`}
              >
                <Settings size={18} />
                הגדרות מערכת
              </Link>
            )}
            {canManageUsers(profile?.role) && (
              <Link
                href="/backup"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname.startsWith("/backup")
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "text-foreground-subtle hover:bg-background"
                }`}
              >
                <DatabaseBackup size={18} />
                גיבוי ושחזור
              </Link>
            )}
            <Link
              href="/about"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith("/about")
                  ? "bg-brand-blue-soft text-brand-blue"
                  : "text-foreground-subtle hover:bg-background"
              }`}
            >
              <Info size={18} />
              אודות המערכת
            </Link>
          </nav>
          <div className="border-t border-border p-3">
            <div className="mb-2 rounded-lg bg-background px-3 py-2">
              <p className="truncate text-sm font-medium">{profile?.displayName}</p>
              <p className="text-xs text-foreground-subtle">
                {profile ? ROLE_LABELS[profile.role] : ""}
              </p>
            </div>
            <button
              onClick={() => signOutUser()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground-subtle hover:bg-background"
            >
              <LogOut size={18} />
              התנתקות
            </button>
            <p className="mt-2 text-center text-xs text-foreground-subtle">
              {APP_NAME} <span className="font-semibold text-brand-pink">{APP_VERSION}</span>
            </p>
          </div>
        </aside>
      )}
      {!menuOpen && (
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="פתיחת תפריט"
          className="fixed top-3 right-3 z-10 rounded-lg border border-border bg-surface p-2 shadow-sm"
        >
          <Menu size={18} />
        </button>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        {isDemoMode && (
          <div className="bg-brand-amber-soft px-4 py-2 text-center text-sm font-medium text-brand-amber">
            מצב מקומי — הנתונים נשמרים בדפדפן זה בלבד (אין חיבור ל-Firebase). לחיבור קבוע יש
            להשלים את ההגדרה לפי SETUP.md.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
