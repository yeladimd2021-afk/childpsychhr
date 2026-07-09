import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDoc, listDocs, updateDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import type { Position, PositionFormValues } from "@/lib/schemas/position";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "positions";

function positionLabel(values: { role: string | null }) {
  return values.role ?? "תקן";
}

async function fetchPositions(): Promise<Position[]> {
  return listDocs<Position>(COLLECTION);
}

export function usePositionsQuery() {
  return useQuery({ queryKey: [COLLECTION], queryFn: fetchPositions });
}

export function useCreatePositionMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (values: PositionFormValues) => {
      const now = Date.now();
      const id = await createDoc(COLLECTION, { ...values, createdAt: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "position",
        entityId: id,
        entityLabel: positionLabel(values),
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

export function useUpdatePositionMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      before,
      values,
    }: {
      id: string;
      before: Position;
      values: PositionFormValues;
    }) => {
      const updatedAt = Date.now();
      await updateDocById(COLLECTION, id, { ...values, updatedAt });
      const changes = diffFields(
        before as unknown as Record<string, string | number | boolean | null>,
        { ...values, updatedAt } as unknown as Record<string, string | number | boolean | null>
      ).filter((c) => c.field !== "updatedAt");
      await recordHistoryEntry({
        entityType: "position",
        entityId: id,
        entityLabel: positionLabel(values),
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}

/** Sets a position's status directly (e.g. פנוי → מוקפא) without a full form submit —
 * used by quick row actions. */
export function useSetPositionStatusMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      before,
      status,
    }: {
      id: string;
      before: Position;
      status: Position["status"];
    }) => {
      const updatedAt = Date.now();
      await updateDocById(COLLECTION, id, { status, updatedAt });
      const changes = diffFields(
        before as unknown as Record<string, string | number | boolean | null>,
        { status, updatedAt } as unknown as Record<string, string | number | boolean | null>
      ).filter((c) => c.field !== "updatedAt");
      await recordHistoryEntry({
        entityType: "position",
        entityId: id,
        entityLabel: positionLabel(before),
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}
