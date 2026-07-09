import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDoc, listDocs, updateDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import type { BudgetItem, BudgetItemFormValues, Unit, UnitFormValues } from "@/lib/schemas/unit";
import { useAuth } from "@/lib/auth/AuthContext";

const UNITS = "units";
const BUDGET_ITEMS = "budgetItems";

export function useUnitsQuery() {
  return useQuery({ queryKey: [UNITS], queryFn: () => listDocs<Unit>(UNITS) });
}

export function useBudgetItemsQuery() {
  return useQuery({ queryKey: [BUDGET_ITEMS], queryFn: () => listDocs<BudgetItem>(BUDGET_ITEMS) });
}

export function useCreateUnitMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (values: UnitFormValues) => {
      const now = Date.now();
      const id = await createDoc(UNITS, { ...values, createdAt: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "unit",
        entityId: id,
        entityLabel: values.name,
        action: "create",
        changes: [],
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [UNITS] }),
  });
}

export function useUpdateUnitMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ id, before, values }: { id: string; before: Unit; values: UnitFormValues }) => {
      const updatedAt = Date.now();
      await updateDocById(UNITS, id, { ...values, updatedAt });
      const changes = diffFields(
        before as unknown as Record<string, string | number | boolean | null>,
        { ...values, updatedAt } as unknown as Record<string, string | number | boolean | null>
      ).filter((c) => c.field !== "updatedAt");
      await recordHistoryEntry({
        entityType: "unit",
        entityId: id,
        entityLabel: values.name,
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [UNITS] }),
  });
}

export function useCreateBudgetItemMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (values: BudgetItemFormValues) => {
      const now = Date.now();
      const id = await createDoc(BUDGET_ITEMS, { ...values, createdAt: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "budgetItem",
        entityId: id,
        entityLabel: values.label,
        action: "create",
        changes: [],
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BUDGET_ITEMS] }),
  });
}

export function useUpdateBudgetItemMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      before,
      values,
    }: {
      id: string;
      before: BudgetItem;
      values: BudgetItemFormValues;
    }) => {
      const updatedAt = Date.now();
      await updateDocById(BUDGET_ITEMS, id, { ...values, updatedAt });
      const changes = diffFields(
        before as unknown as Record<string, string | number | boolean | null>,
        { ...values, updatedAt } as unknown as Record<string, string | number | boolean | null>
      ).filter((c) => c.field !== "updatedAt");
      await recordHistoryEntry({
        entityType: "budgetItem",
        entityId: id,
        entityLabel: values.label,
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BUDGET_ITEMS] }),
  });
}
