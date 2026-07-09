import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db, isDemoMode } from "@/lib/firebase/config";
import { listDocs } from "@/lib/data/dataClient";
import type { AuditLogEntry, EntityType } from "@/lib/schemas/auditLog";

const COLLECTION = "auditLog";

export function useAuditLogQuery() {
  return useQuery({
    queryKey: [COLLECTION, "global"],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (isDemoMode) {
        const all = await listDocs<AuditLogEntry>(COLLECTION);
        return [...all].sort((a, b) => b.changedAt - a.changedAt).slice(0, 200);
      }
      const q = query(collection(db!, COLLECTION), orderBy("changedAt", "desc"), limit(200));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry);
    },
  });
}

/** Unlike useAuditLogQuery (capped at 200, newest-first, for the Audit page's display list),
 * this returns the full history in ascending order — for domain logic that needs to replay
 * events forward in time (trends, vacancy-age, insights), not just show recent entries. */
export function useAllAuditLogQuery() {
  return useQuery({
    queryKey: [COLLECTION, "all"],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (isDemoMode) {
        const all = await listDocs<AuditLogEntry>(COLLECTION);
        return [...all].sort((a, b) => a.changedAt - b.changedAt);
      }
      const q = query(collection(db!, COLLECTION), orderBy("changedAt", "asc"), limit(5000));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry);
    },
  });
}

export function useEntityHistoryQuery(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: [COLLECTION, entityType, entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (isDemoMode) {
        const all = await listDocs<AuditLogEntry>(COLLECTION);
        return all
          .filter((e) => e.entityType === entityType && e.entityId === entityId)
          .sort((a, b) => b.changedAt - a.changedAt);
      }
      const q = query(
        collection(db!, COLLECTION),
        where("entityType", "==", entityType),
        where("entityId", "==", entityId),
        orderBy("changedAt", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry);
    },
  });
}
