"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  APP_DEPARTMENT,
  APP_DESCRIPTION,
  APP_NAME,
  APP_SUBTITLE,
  APP_VERSION,
  APP_VERSION_DATE,
  RELEASE_NOTES,
} from "@/lib/branding";

export default function AboutPage() {
  const { isDemoMode } = useAuth();

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Logo variant="full" size={72} />
          <div>
            <h1 dir="ltr" className="text-right text-2xl font-bold text-brand-blue">{APP_NAME}</h1>
            <p className="text-sm text-foreground-subtle">{APP_SUBTITLE}</p>
            <p className="text-sm text-foreground-subtle">{APP_DEPARTMENT}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-foreground-subtle">גרסה</p>
          <p className="mt-2">
            <Badge tone="pink">{APP_VERSION}</Badge>
          </p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-subtle">תאריך גרסה</p>
          <p className="mt-2 text-xl font-semibold">{APP_VERSION_DATE}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-subtle">סביבת עבודה</p>
          <p className="mt-2">
            <Badge tone={isDemoMode ? "amber" : "green"}>
              {isDemoMode ? "מצב מקומי (Demo)" : "Production — מחובר ל-Firebase"}
            </Badge>
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-medium">מטרת המערכת</h2>
        <p className="text-sm leading-relaxed text-foreground-subtle">{APP_DESCRIPTION}</p>
      </Card>

      <Card>
        <h2 className="mb-4 font-medium">היסטוריית גרסאות</h2>
        <div className="flex flex-col gap-4">
          {RELEASE_NOTES.map((entry) => (
            <div key={entry.version} className="border-r-2 border-brand-blue-soft pr-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Badge tone="pink">{entry.version}</Badge>
                <span className="text-xs font-normal text-foreground-subtle">{entry.date}</span>
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-foreground-subtle">
                {entry.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
