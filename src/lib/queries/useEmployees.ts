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

/** Marks an employee as having left (or brings them back). Deactivating also ends every
 * currently-active assignment of theirs, so budget items they held stop looking occupied — the
 * employee record itself is never deleted, only flagged. */
export function useSetEmployeeActiveMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      employee,
      active,
      activeAssignmentIds,
    }: {
      employee: Employee;
      active: boolean;
      activeAssignmentIds: string[];
    }) => {
      const now = Date.now();
      const changedBy = user?.uid ?? "unknown";
      const changedByName = profile?.displayName ?? "unknown";

      await updateDocById(COLLECTION, employee.id, { active, updatedAt: now });
      await recordHistoryEntry({
        entityType: "employee",
        entityId: employee.id,
        entityLabel: formatEmployeeName(employee),
        action: "update",
        changes: [{ field: "active", oldValue: employee.active ?? true, newValue: active }],
        changedBy,
        changedByName,
      });

      if (!active) {
        for (const assignmentId of activeAssignmentIds) {
          await updateDocById("assignments", assignmentId, { endDate: now, updatedAt: now });
          await recordHistoryEntry({
            entityType: "assignment",
            entityId: assignmentId,
            entityLabel: `${formatEmployeeName(employee)} — עזיבה`,
            action: "update",
            changes: [{ field: "endDate", oldValue: null, newValue: now }],
            changedBy,
            changedByName,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
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
