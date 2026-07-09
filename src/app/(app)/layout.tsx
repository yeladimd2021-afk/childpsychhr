"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AppShell } from "@/components/shell/AppShell";
import { UnauthorizedScreen } from "@/components/shell/UnauthorizedScreen";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, loadError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground-subtle">
        טוען...
      </div>
    );
  }

  if (!user) return null;

  if (loadError) return <UnauthorizedScreen reason="load-error" />;
  if (!profile) return <UnauthorizedScreen reason="no-profile" />;
  if (!profile.active) return <UnauthorizedScreen reason="inactive" />;

  return <AppShell>{children}</AppShell>;
}
