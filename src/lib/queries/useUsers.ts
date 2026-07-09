import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listDocs, updateDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import type { UserProfile, UserRole } from "@/lib/schemas/user";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "users";

export function useUsersQuery() {
  return useQuery({
    queryKey: [COLLECTION],
    queryFn: async () => {
      const docs = await listDocs<UserProfile>(COLLECTION);
      return docs.map((d) => ({ ...d, uid: d.id }));
    },
  });
}

export function useSetUserRoleMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ before, role }: { before: UserProfile; role: UserRole }) => {
      await updateDocById(COLLECTION, before.uid, { role });
      await recordHistoryEntry({
        entityType: "user",
        entityId: before.uid,
        entityLabel: before.displayName,
        action: "update",
        changes: diffFields({ role: before.role }, { role }).map((c) => ({
          ...c,
          oldValue: ROLE_LABELS[c.oldValue as UserRole] ?? c.oldValue,
          newValue: ROLE_LABELS[c.newValue as UserRole] ?? c.newValue,
        })),
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}

export function useSetUserActiveMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ before, active }: { before: UserProfile; active: boolean }) => {
      await updateDocById(COLLECTION, before.uid, { active });
      await recordHistoryEntry({
        entityType: "user",
        entityId: before.uid,
        entityLabel: before.displayName,
        action: "update",
        changes: diffFields({ active: before.active }, { active }),
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}
