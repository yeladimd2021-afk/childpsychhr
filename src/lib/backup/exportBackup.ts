import { listDocs } from "@/lib/data/dataClient";
import { BACKUP_COLLECTIONS } from "./collections";

/** Bump if the backup file shape ever changes in a way that needs migration logic on import. */
export const BACKUP_FORMAT_VERSION = 1;

export type FullBackup = {
  formatVersion: number;
  exportedAt: number;
  collections: Record<string, Array<Record<string, unknown> & { id: string }>>;
};

export async function buildFullBackup(): Promise<FullBackup> {
  const collections: FullBackup["collections"] = {};
  for (const name of BACKUP_COLLECTIONS) {
    collections[name] = await listDocs<Record<string, unknown>>(name);
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    collections,
  };
}

export async function downloadFullBackup(): Promise<FullBackup> {
  const backup = await buildFullBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `גיבוי-מערכת-תקנים-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return backup;
}
