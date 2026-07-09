import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDoc, listDocs, updateDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import { formatEmployeeName, type Employee, type EmployeeFormValues } from "@/lib/schemas/employee";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "employees";

async function fetchEmployees(): Promise<Employee[]> {
  return listDocs<Employee>(COLLECTION);
}

export function useEmployeesQuery() {
  return useQuery({ queryKey: [COLLECTION], queryFn: fetchEmployees });
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      const now = Date.now();
      const id = await createDoc(COLLECTION, { ...values, createdAt: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "employee",
        entityId: id,
        entityLabel: formatEmployeeName(values),
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

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      before,
      values,
    }: {
      id: string;
      before: Employee;
      values: EmployeeFormValues;
    }) => {
      const updatedAt = Date.now();
      await updateDocById(COLLECTION, id, { ...values, updatedAt });
      const changes = diffFields(
        before as unknown as Record<string, string | number | boolean | null>,
        { ...values, updatedAt } as unknown as Record<string, string | number | boolean | null>
      ).filter((c) => c.field !== "updatedAt");
      await recordHistoryEntry({
        entityType: "employee",
        entityId: id,
        entityLabel: formatEmployeeName(values),
        action: "update",
        changes,
        changedBy: user?.uid ?? "unknown",
        changedByName: profile?.displayName ?? "unknown",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLLECTION] }),
  });
}
