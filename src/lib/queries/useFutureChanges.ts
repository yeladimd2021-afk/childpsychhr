import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDoc, listDocs, updateDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import type { FutureChange, FutureChangeFormValues } from "@/lib/schemas/futureChange";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "futureChanges";

export function useFutureChangesQuery() {
  return useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<FutureChange>(COLLECTION),
  });
}

export function useCreateFutureChangeMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (values: FutureChangeFormValues) => {
      const now = Date.now();
      const id = await createDoc(COLLECTION, { ...values, createdAt: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "futureChange",
        entityId: id,
        entityLabel: `${values.firstName} ${values.lastName}`,
        action: "create",
        changes: [],
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}

export function useUpdateFutureChangeMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      before,
      values,
    }: {
      id: string;
      before: FutureChange;
      values: FutureChangeFormValues;
    }) => {
      const updatedAt = Date.now();
      await updateDocById(COLLECTION, id, { ...values, updatedAt });
      const changes = diffFields(
        before as unknown as Record<string, string | number | boolean | null>,
        { ...values, updatedAt } as unknown as Record<string, string | number | boolean | null>
      ).filter((c) => c.field !== "updatedAt");
      await recordHistoryEntry({
        entityType: "futureChange",
        entityId: id,
        entityLabel: `${values.firstName} ${values.lastName}`,
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}
