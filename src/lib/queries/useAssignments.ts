import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDoc, listDocs, updateDocById } from "@/lib/data/dataClient";
import { diffFields, recordHistoryEntry } from "@/lib/firebase/history";
import type { Assignment } from "@/lib/schemas/assignment";
import type { EmployeeFormValues } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { BudgetItem } from "@/lib/schemas/unit";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "assignments";
const EMPLOYEES = "employees";

async function fetchAssignments(): Promise<Assignment[]> {
  return listDocs<Assignment>(COLLECTION);
}

export function useAssignmentsQuery() {
  return useQuery({ queryKey: [COLLECTION], queryFn: fetchAssignments });
}

function budgetItemLabel(b: Pick<BudgetItem, "code" | "label">) {
  return `${b.code} · ${b.label}`;
}

type AssignToBudgetItemInput = {
  budgetItem: BudgetItem;
  employee: { mode: "existing"; employeeId: string; label: string } | { mode: "new"; values: EmployeeFormValues };
  role: string | null;
  startDate: number | null;
  startDateText: string | null;
  endDate: number | null;
  employmentPercent: number | null;
  notes?: string;
};

/** Assigns an employee (existing or newly created) directly to a budget item: creates the
 * Assignment record. Position is never involved — from the user's point of view, this is the
 * one and only "add a person" action. */
export function useAssignToBudgetItemMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (input: AssignToBudgetItemInput) => {
      const now = Date.now();
      const changedBy = user?.uid ?? "unknown";
      const changedByName = profile?.displayName ?? "unknown";

      let employeeId: string;
      let employeeLabel: string;
      if (input.employee.mode === "existing") {
        employeeId = input.employee.employeeId;
        employeeLabel = input.employee.label;
      } else {
        employeeId = await createDoc(EMPLOYEES, {
          ...input.employee.values,
          createdAt: now,
          updatedAt: now,
        });
        employeeLabel = formatEmployeeName(input.employee.values);
        await recordHistoryEntry({
          entityType: "employee",
          entityId: employeeId,
          entityLabel: employeeLabel,
          action: "create",
          changes: [],
          changedBy,
          changedByName,
        });
      }

      const assignmentId = await createDoc(COLLECTION, {
        employeeId,
        budgetItemId: input.budgetItem.id,
        positionId: null,
        role: input.role,
        startDate: input.startDate,
        startDateText: input.startDateText,
        endDate: input.endDate,
        employmentPercent: input.employmentPercent,
        notes: input.notes ?? "",
        createdAt: now,
        updatedAt: now,
      });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: assignmentId,
        entityLabel: `${employeeLabel} → ${budgetItemLabel(input.budgetItem)}`,
        action: "create",
        changes: [],
        changedBy,
        changedByName,
      });

      return assignmentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES] });
    },
  });
}

/** Ends an active assignment (sets endDate) — the assignment itself is kept, not deleted, so
 * "who was assigned here before" history survives. */
export function useEndAssignmentMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      assignment,
      employeeLabel,
      budgetItem,
    }: {
      assignment: Assignment;
      employeeLabel: string;
      budgetItem: BudgetItem;
    }) => {
      const now = Date.now();
      const changedBy = user?.uid ?? "unknown";
      const changedByName = profile?.displayName ?? "unknown";

      await updateDocById(COLLECTION, assignment.id, { endDate: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: assignment.id,
        entityLabel: `${employeeLabel} → ${budgetItemLabel(budgetItem)}`,
        action: "update",
        changes: [{ field: "endDate", oldValue: null, newValue: now }],
        changedBy,
        changedByName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
    },
  });
}

type UpdateAssignmentValues = {
  role: string | null;
  employmentPercent: number | null;
  startDate: number | null;
  startDateText: string | null;
  endDate: number | null;
  notes?: string;
};

/** Edits an existing assignment's own fields (role/percent/dates/notes) without touching who
 * it's linked to. */
export function useUpdateAssignmentMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      before,
      values,
      employeeLabel,
      budgetItem,
    }: {
      id: string;
      before: Assignment;
      values: UpdateAssignmentValues;
      employeeLabel: string;
      budgetItem: BudgetItem;
    }) => {
      const now = Date.now();
      const changedBy = user?.uid ?? "unknown";
      const changedByName = profile?.displayName ?? "unknown";

      // Firestore's updateDoc() rejects an explicit `undefined` field value (unlike a missing
      // key) — normalize before writing, not just for the diff.
      const notes = values.notes ?? "";
      await updateDocById(COLLECTION, id, { ...values, notes, updatedAt: now });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: id,
        entityLabel: `${employeeLabel} → ${budgetItemLabel(budgetItem)}`,
        action: "update",
        changes: diffFields(before, { ...values, notes }),
        changedBy,
        changedByName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
    },
  });
}

/** Moves an employee from their current budget item to a different one in a single action:
 * closes the old assignment, opens a new one. */
export function useTransferAssignmentMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      currentAssignment,
      currentBudgetItem,
      targetBudgetItem,
      employeeLabel,
      role,
      startDate,
      startDateText,
      employmentPercent,
      notes,
    }: {
      currentAssignment: Assignment;
      currentBudgetItem: BudgetItem;
      targetBudgetItem: BudgetItem;
      employeeLabel: string;
      role: string | null;
      startDate: number | null;
      startDateText: string | null;
      employmentPercent: number | null;
      notes?: string;
    }) => {
      const now = Date.now();
      const changedBy = user?.uid ?? "unknown";
      const changedByName = profile?.displayName ?? "unknown";

      await updateDocById(COLLECTION, currentAssignment.id, { endDate: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: currentAssignment.id,
        entityLabel: `${employeeLabel} → ${budgetItemLabel(currentBudgetItem)}`,
        action: "update",
        changes: [{ field: "endDate", oldValue: null, newValue: now }],
        changedBy,
        changedByName,
      });

      const newAssignmentId = await createDoc(COLLECTION, {
        employeeId: currentAssignment.employeeId,
        budgetItemId: targetBudgetItem.id,
        positionId: null,
        role,
        startDate,
        startDateText,
        endDate: null,
        employmentPercent,
        notes: notes ?? "",
        createdAt: now,
        updatedAt: now,
      });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: newAssignmentId,
        entityLabel: `${employeeLabel} → ${budgetItemLabel(targetBudgetItem)}`,
        action: "create",
        changes: [],
        changedBy,
        changedByName,
      });

      return newAssignmentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
    },
  });
}
