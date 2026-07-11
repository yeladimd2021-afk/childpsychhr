/** Every collection a full system backup/restore covers — single source of truth so export
 * and import can never silently drift apart on which tables are included. */
export const BACKUP_COLLECTIONS = [
  "units",
  "budgetItems",
  "positions",
  "employees",
  "assignments",
  "futureChanges",
  "vacancyReviews",
  "users",
  "systemSettings",
  "auditLog",
] as const;
export type BackupCollectionName = (typeof BACKUP_COLLECTIONS)[number];
