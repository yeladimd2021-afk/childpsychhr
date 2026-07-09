"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { canEdit, canManageUsers } from "@/lib/auth/permissions";
import { useUnitsQuery } from "@/lib/queries/useUnits";
import { commitImportedFutureChanges, commitImportedPositions } from "@/lib/import/commitImport";
import { clearAllLocalData } from "@/lib/data/dataClient";
import type { ParsedPositionRow } from "@/lib/import/parsePositionsSheet";
import type { ParsedFutureChangeRow } from "@/lib/import/parseFutureChangesSheet";

type ParseResponse = {
  positionsSheetName: string;
  positionRows: ParsedPositionRow[];
  headerWarnings: string[];
  futureChangesSheetFound: boolean;
  futureChangeRows: ParsedFutureChangeRow[];
  futureChangesExcludedCount: number;
};

export default function ImportPage() {
  const { user, profile, isDemoMode } = useAuth();
  const { data: units = [] } = useUnitsQuery();
  const queryClient = useQueryClient();

  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{
    createdUnits: number;
    createdPositions: number;
    createdEmployees: number;
    createdFutureChanges: number;
  } | null>(null);

  if (!canEdit(profile?.role)) {
    return (
      <div className="p-8 text-sm text-foreground-subtle">
        אין לך הרשאה לייבא נתונים. פנה/י למנהל המערכת.
      </div>
    );
  }

  async function handleClearAllData() {
    const confirmed = window.confirm(
      "פעולה זו תמחק את כל הנתונים השמורים במחשב הזה (עובדים, יחידות, שינויים עתידיים) ולא ניתנת לביטול. להמשיך?"
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      clearAllLocalData();
      await queryClient.invalidateQueries();
      setResult(null);
      setParsed(null);
    } finally {
      setClearing(false);
    }
  }

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setResult(null);
    setParsed(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setParseError(json.error ?? "שגיאה בעיבוד הקובץ");
        return;
      }
      setParsed(json as ParseResponse);
    } catch {
      setParseError("שגיאה בהעלאת הקובץ — ודא/י שהשרת פועל ונסה/י שוב");
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!parsed || !user || !profile) return;
    setCommitting(true);
    try {
      const positionsSummary = await commitImportedPositions({
        rows: parsed.positionRows,
        existingUnits: units,
        userId: user.uid,
        userName: profile.displayName,
      });
      const changesSummary = await commitImportedFutureChanges({
        rows: parsed.futureChangeRows,
        userId: user.uid,
        userName: profile.displayName,
      });
      setResult({ ...positionsSummary, ...changesSummary });
      setParsed(null);
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["futureChanges"] });
    } finally {
      setCommitting(false);
    }
  }

  const warningsCount = parsed?.positionRows.filter((r) => r.warnings.length > 0).length ?? 0;
  const changeWarningsCount =
    parsed?.futureChangeRows.filter((r) => r.warnings.length > 0).length ?? 0;

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">יבוא מקובץ Excel</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            הקובץ צריך לכלול גיליון בשם &quot;פירוט תקנים&quot; (עובדים ותקנים) עם הכותרות בשורה 5 —
            וגיליון &quot;שינויים בקרוב&quot; אם קיים, לייבוא שינויים עתידיים. כרגע המערכת מיועדת
            להזנה ידנית — הייבוא כאן זמין לשימוש עתידי במידת הצורך.
          </p>
        </div>
        {isDemoMode && canManageUsers(profile?.role) && (
          <button
            onClick={handleClearAllData}
            disabled={clearing}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-brand-red px-4 py-2 text-sm font-medium text-brand-red hover:bg-brand-red-soft disabled:opacity-60"
          >
            <Trash2 size={16} />
            {clearing ? "מנקה..." : "נקה נתונים וייבא מחדש"}
          </button>
        )}
      </div>

      <Card className="mt-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-center hover:bg-background">
          <Upload className="text-foreground-subtle" />
          <span className="text-sm font-medium">בחר/י קובץ Excel (.xlsx)</span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
        {parsing && <p className="mt-3 text-sm text-foreground-subtle">מעבד את הקובץ...</p>}
        {parseError && (
          <p className="mt-3 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
            {parseError}
          </p>
        )}
        {result && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-green-soft px-3 py-2 text-sm text-brand-green">
            <CheckCircle2 size={16} />
            הייבוא הושלם: {result.createdPositions} תקנים, {result.createdEmployees} עובדים,{" "}
            {result.createdFutureChanges} שינויים עתידיים, {result.createdUnits} יחידות חדשות נוצרו.
          </p>
        )}
      </Card>

      {parsed && (
        <>
          {parsed.headerWarnings.length > 0 && (
            <Card className="mt-6 border-brand-amber">
              <p className="mb-2 flex items-center gap-2 font-medium text-brand-amber">
                <AlertTriangle size={16} />
                שימו לב למבנה הקובץ
              </p>
              <ul className="flex flex-col gap-1 text-sm text-foreground-subtle">
                {parsed.headerWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  עובדים ותקנים — גיליון &quot;{parsed.positionsSheetName}&quot;,{" "}
                  {parsed.positionRows.length} שורות
                </p>
                {warningsCount > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-brand-amber">
                    <AlertTriangle size={14} />
                    {warningsCount} שורות עם הערות לבדיקה — ניתן לתקן לאחר הייבוא במסך העובדים
                  </p>
                )}
                {parsed.futureChangesSheetFound && (
                  <p className="mt-1 text-sm text-foreground-subtle">
                    נמצאו {parsed.futureChangeRows.length} שינויים עתידיים לייבוא
                    {changeWarningsCount > 0 && ` (${changeWarningsCount} מהם עם הערות לבדיקה)`}
                    {parsed.futureChangesExcludedCount > 0 &&
                      ` · ${parsed.futureChangesExcludedCount} שורות בסעיף "לא תקנים שלנו" לא יובאו (מידע חיצוני, לעיון בלבד)`}
                  </p>
                )}
                {!parsed.futureChangesSheetFound && (
                  <p className="mt-1 text-sm text-foreground-subtle">
                    לא נמצא גיליון &quot;שינויים בקרוב&quot; בקובץ — רק עובדים ותקנים יובאו.
                  </p>
                )}
              </div>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
              >
                {committing
                  ? "מייבא..."
                  : `ייבוא ${parsed.positionRows.length + parsed.futureChangeRows.length} רשומות`}
              </button>
            </div>

            <div className="max-h-[500px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background text-xs text-foreground-subtle">
                  <tr>
                    <th className="px-3 py-2 text-right">שם עובד</th>
                    <th className="px-3 py-2 text-right">ת.ז.</th>
                    <th className="px-3 py-2 text-right">מקור</th>
                    <th className="px-3 py-2 text-right">יחידה</th>
                    <th className="px-3 py-2 text-right">תפקיד</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2 text-right">סטטוס</th>
                    <th className="px-3 py-2 text-right">הערות ייבוא</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.positionRows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-border">
                      <td className="px-3 py-2">
                        {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td dir="ltr" className="px-3 py-2 text-left">
                        {row.idNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2">{row.fundingSource}</td>
                      <td className="px-3 py-2">{row.unitNameRaw ?? "—"}</td>
                      <td className="px-3 py-2">{row.role ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.employmentPercent !== null
                          ? `${Math.round(row.employmentPercent * 100)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{row.employeeStatus}</td>
                      <td className="px-3 py-2">
                        {row.warnings.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {row.warnings.map((w, i) => (
                              <Badge key={i} tone="amber">
                                {w}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge tone="green">תקין</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {parsed.futureChangesSheetFound && parsed.futureChangeRows.length > 0 && (
            <Card className="mt-6">
              <p className="mb-4 font-medium">
                שינויים עתידיים — גיליון &quot;שינויים בקרוב&quot;, {parsed.futureChangeRows.length}{" "}
                שורות
              </p>
              <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background text-xs text-foreground-subtle">
                    <tr>
                      <th className="px-3 py-2 text-right">שם</th>
                      <th className="px-3 py-2 text-right">סוג שינוי</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-right">תאריך</th>
                      <th className="px-3 py-2 text-right">מקור</th>
                      <th className="px-3 py-2 text-right">הערות ייבוא</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.futureChangeRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="px-3 py-2">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={row.changeType === "עזיבה" ? "red" : "green"}>
                            {row.changeType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {row.employmentPercent !== null
                            ? `${Math.round(row.employmentPercent * 100)}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.effectiveDateText ??
                            (row.effectiveDate
                              ? new Date(row.effectiveDate).toLocaleDateString("he-IL")
                              : "—")}
                        </td>
                        <td className="px-3 py-2">{row.fundingSource ?? "—"}</td>
                        <td className="px-3 py-2">
                          {row.warnings.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {row.warnings.map((w, i) => (
                                <Badge key={i} tone="amber">
                                  {w}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge tone="green">תקין</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
