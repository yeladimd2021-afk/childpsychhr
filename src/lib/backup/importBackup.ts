import { setDocById, clearAllLocalData } from "@/lib/data/dataClient";
import { BACKUP_COLLECTIONS, type BackupCollectionName } from "./collections";
import type { FullBackup } from "./exportBackup";

export class InvalidBackupFileError extends Error {}

export type RestoreResult = {
  restoredCounts: Partial<Record<BackupCollectionName, number>>;
};

function isKnownCollection(name: string): name is BackupCollectionName {
  return (BACKUP_COLLECTIONS as readonly string[]).includes(name);
}

/** Structural validation only (known collection keys, each doc an object with a string id) —
 * deliberately not full Zod parsing per entity, so this stays resilient to schema evolution and
 * doesn't need updating every time a field is added to some entity elsewhere in the app. */
function parseBackupFile(raw: string): FullBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidBackupFileError("הקובץ אינו JSON תקין.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("collections" in parsed) ||
    typeof (parsed as Record<string, unknown>).collections !== "object" ||
    (parsed as Record<string, unknown>).collections === null
  ) {
    throw new InvalidBackupFileError("מבנה הקובץ אינו תואם לקובץ גיבוי של המערכת.");
  }

  const collections = (parsed as { collections: Record<string, unknown> }).collections;
  for (const [name, docs] of Object.entries(collections)) {
    if (!isKnownCollection(name)) continue; // ignore unrecognized/future keys gracefully
    if (!Array.isArray(docs)) {
      throw new InvalidBackupFileError(`האוסף "${name}" בקובץ הגיבוי אינו רשימה תקינה.`);
    }
    for (const doc of docs) {
      if (typeof doc !== "object" || doc === null || typeof (doc as Record<string, unknown>).id !== "string") {
        throw new InvalidBackupFileError(`נמצאה רשומה ללא מזהה תקין באוסף "${name}".`);
      }
    }
  }

  return parsed as FullBackup;
}

/** Restores every document from the backup by its original id (upsert via setDocById) —
 * preserves every Position/Employee/Assignment cross-reference exactly, and never deletes a
 * document that exists now but wasn't in the backup, matching this app's "never hard-delete"
 * rule (and Firestore's security rules, which deny delete entirely). `wipeFirst` gives an
 * exact-snapshot restore but only actually clears anything in local demo mode — a no-op
 * against real Firestore, where the UI should not offer that option at all. */
export async function restoreFromBackupFile(
  file: File,
  options: { wipeFirst: boolean }
): Promise<RestoreResult> {
  const raw = await file.text();
  const backup = parseBackupFile(raw);

  if (options.wipeFirst) clearAllLocalData();

  const restoredCounts: RestoreResult["restoredCounts"] = {};
  for (const name of BACKUP_COLLECTIONS) {
    const docs = backup.collections[name];
    if (!docs) continue;
    for (const doc of docs) {
      const { id, ...rest } = doc;
      await setDocById(name, id, rest);
    }
    restoredCounts[name] = docs.length;
  }

  return { restoredCounts };
}
