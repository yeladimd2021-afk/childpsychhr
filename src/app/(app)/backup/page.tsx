"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth/AuthContext";
import { canManageUsers } from "@/lib/auth/permissions";
import { downloadFullBackup } from "@/lib/backup/exportBackup";
import { restoreFromBackupFile, InvalidBackupFileError } from "@/lib/backup/importBackup";
import { exportAllToExcel } from "@/lib/export/exportAllToExcel";
import type { BackupCollectionName } from "@/lib/backup/collections";

const COLLECTION_DISPLAY_NAMES: Record<BackupCollectionName, string> = {
  units: "יחידות",
  budgetItems: "סעיפי תקציב",
  positions: "תקנים",
  employees: "עובדים",
  assignments: "שיבוצים",
  futureChanges: "שינויים עתידיים",
  vacancyReviews: "בדיקות תקן פנוי",
  users: "משתמשים",
  systemSettings: "הגדרות מערכת",
  auditLog: "יומן שינויים",
};

export default function BackupPage() {
  const { profile, isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const [exportingJson, setExportingJson] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [wipeFirst, setWipeFirst] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (!canManageUsers(profile?.role)) {
    return (
      <div className="p-8 text-sm text-foreground-subtle">
        מסך גיבוי ושחזור זמין למנהלי מערכת בלבד.
      </div>
    );
  }

  async function handleExportJson() {
    setExportingJson(true);
    try {
      await downloadFullBackup();
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      await exportAllToExcel();
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleRestore() {
    if (!file) return;
    const confirmed = window.confirm(
      wipeFirst
        ? 'פעולה זו תמחק את כל הנתונים הקיימים ותשחזר את הקובץ שנבחר במקומם. לא ניתן לבטל. להמשיך?'
        : "פעולה זו תכתוב מחדש כל רשומה שמופיעה בקובץ הגיבוי (לפי מזהה מקורי). רשומות קיימות שלא מופיעות בקובץ יישארו ללא שינוי. להמשיך?"
    );
    if (!confirmed) return;

    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const { restoredCounts } = await restoreFromBackupFile(file, { wipeFirst });
      await queryClient.invalidateQueries();
      const summary = Object.entries(restoredCounts)
        .map(([name, count]) => `${COLLECTION_DISPLAY_NAMES[name as BackupCollectionName]}: ${count}`)
        .join(" · ");
      setRestoreResult(`השחזור הושלם — ${summary}`);
      setFile(null);
    } catch (err) {
      setRestoreError(
        err instanceof InvalidBackupFileError ? err.message : "שחזור הקובץ נכשל — ודא/י שזהו קובץ גיבוי תקין."
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-semibold">גיבוי ושחזור</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          גיבוי מלא של כל הנתונים במערכת לפני שינוי משמעותי, ושחזור בעת הצורך
        </p>
      </div>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-medium">
          <Download size={18} className="text-brand-blue" />
          ייצוא מלא (JSON)
        </h2>
        <p className="mb-4 text-sm text-foreground-subtle">
          קובץ אחד עם כל הנתונים במערכת — תקנים, עובדים, שיבוצים, יחידות, סעיפי תקציב, שינויים
          עתידיים, משתמשים, הגדרות מערכת ויומן השינויים המלא. הקובץ הזה הוא הגיבוי שממנו ניתן
          לשחזר את המערכת במדויק.
        </p>
        <button
          onClick={handleExportJson}
          disabled={exportingJson}
          className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
        >
          <Download size={16} />
          {exportingJson ? "מייצא..." : "הורדת גיבוי מלא"}
        </button>
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-medium">
          <Upload size={18} className="text-brand-amber" />
          שחזור מקובץ JSON
        </h2>
        <p className="mb-4 text-sm text-foreground-subtle">
          בחר/י קובץ גיבוי שהופק מהמסך הזה. כל רשומה בקובץ נכתבת מחדש לפי המזהה המקורי שלה —
          שיוכי תקן/עובד/שיבוץ נשמרים במדויק, ושום רשומה קיימת לא נמחקת.
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setRestoreResult(null);
              setRestoreError(null);
            }}
            className="text-sm"
          />
          {isDemoMode && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wipeFirst}
                onChange={(e) => setWipeFirst(e.target.checked)}
              />
              מחק את כל הנתונים הקיימים לפני השחזור (שחזור מדויק לתמונת הגיבוי — זמין רק במצב
              מקומי)
            </label>
          )}
          {restoreError && (
            <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
              {restoreError}
            </p>
          )}
          {restoreResult && (
            <p className="rounded-lg bg-brand-green-soft px-3 py-2 text-sm text-brand-green">
              {restoreResult}
            </p>
          )}
          <div>
            <button
              onClick={handleRestore}
              disabled={!file || restoring}
              className="flex items-center gap-2 rounded-lg bg-brand-amber px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
            >
              <Upload size={16} />
              {restoring ? "משחזר..." : "שחזור"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-medium">
          <FileSpreadsheet size={18} className="text-brand-green" />
          ייצוא לאקסל
        </h2>
        <p className="mb-4 text-sm text-foreground-subtle">
          קובץ Excel אחד עם גיליון נפרד לכל טבלה במערכת — נוח לעיון, סינון או העברה למי שאינו
          משתמש במערכת. לשחזור נתונים יש להשתמש בגיבוי ה-JSON למעלה, לא בקובץ הזה.
        </p>
        <button
          onClick={handleExportExcel}
          disabled={exportingExcel}
          className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-background disabled:opacity-60"
        >
          <FileSpreadsheet size={16} />
          {exportingExcel ? "מייצא..." : "הורדת כל הטבלאות לאקסל"}
        </button>
      </Card>
    </div>
  );
}
