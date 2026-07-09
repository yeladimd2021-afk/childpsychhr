import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDoc, listDocs, updateDocById } from "@/lib/data/dataClient";
import { recordHistoryEntry } from "@/lib/firebase/history";
import type { Assignment } from "@/lib/schemas/assignment";
import type { EmployeeFormValues } from "@/lib/schemas/employee";
import { formatEmployeeName } from "@/lib/schemas/employee";
import type { Position } from "@/lib/schemas/position";
import { useAuth } from "@/lib/auth/AuthContext";

const COLLECTION = "assignments";
const POSITIONS = "positions";
const EMPLOYEES = "employees";

async function fetchAssignments(): Promise<Assignment[]> {
  return listDocs<Assignment>(COLLECTION);
}

export function useAssignmentsQuery() {
  return useQuery({ queryKey: [COLLECTION], queryFn: fetchAssignments });
}

type AssignEmployeeInput = {
  position: Position;
  employee: { mode: "existing"; employeeId: string; label: string } | { mode: "new"; values: EmployeeFormValues };
  startDate: number | null;
  startDateText: string | null;
  employmentPercent: number | null;
  notes?: string;
};

/** Assigns an employee (existing or newly created) to a currently-vacant position: creates
 * the Assignment, and flips the position to מאויש — a single user action spans 2-3 entities. */
export function useAssignEmployeeMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (input: AssignEmployeeInput) => {
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
        positionId: input.position.id,
        startDate: input.startDate,
        startDateText: input.startDateText,
        endDate: null,
        employmentPercent: input.employmentPercent ?? input.position.employmentPercent,
        notes: input.notes ?? "",
        createdAt: now,
        updatedAt: now,
      });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: assignmentId,
        entityLabel: `${employeeLabel} → ${input.position.role ?? "תקן"}`,
        action: "create",
        changes: [],
        changedBy,
        changedByName,
      });

      await updateDocById(POSITIONS, input.position.id, { status: "מאויש", updatedAt: now });
      await recordHistoryEntry({
        entityType: "position",
        entityId: input.position.id,
        entityLabel: input.position.role ?? "תקן",
        action: "update",
        changes: [{ field: "status", oldValue: input.position.status, newValue: "מאויש" }],
        changedBy,
        changedByName,
      });

      return assignmentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
      queryClient.invalidateQueries({ queryKey: [POSITIONS] });
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES] });
    },
  });
}

/** Ends an active assignment (sets endDate) and frees up the position — the assignment
 * itself is kept, not deleted, so "who held this before" history survives. */
export function useEndAssignmentMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      assignment,
      position,
      employeeLabel,
    }: {
      assignment: Assignment;
      position: Position;
      employeeLabel: string;
    }) => {
      const now = Date.now();
      const changedBy = user?.uid ?? "unknown";
      const changedByName = profile?.displayName ?? "unknown";

      await updateDocById(COLLECTION, assignment.id, { endDate: now, updatedAt: now });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: assignment.id,
        entityLabel: `${employeeLabel} → ${position.role ?? "תקן"}`,
        action: "update",
        changes: [{ field: "endDate", oldValue: null, newValue: now }],
        changedBy,
        changedByName,
      });

      await updateDocById(POSITIONS, position.id, { status: "פנוי", updatedAt: now });
      await recordHistoryEntry({
        entityType: "position",
        entityId: position.id,
        entityLabel: position.role ?? "תקן",
        action: "update",
        changes: [{ field: "status", oldValue: position.status, newValue: "פנוי" }],
        changedBy,
        changedByName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
      queryClient.invalidateQueries({ queryKey: [POSITIONS] });
    },
  });
}

/** Moves an employee from their current position to a different (vacant) one in a single
 * action: closes the old assignment, opens a new one, and flips both positions' status —
 * the whole point of separating Position/Employee/Assignment in the first place. */
export function useTransferAssignmentMutation() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      currentAssignment,
      currentPosition,
      targetPosition,
      employeeLabel,
      startDate,
      startDateText,
      employmentPercent,
      notes,
    }: {
      currentAssignment: Assignment;
      currentPosition: Position;
      targetPosition: Position;
      employeeLabel: string;
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
        entityLabel: `${employeeLabel} → ${currentPosition.role ?? "תקן"}`,
        action: "update",
        changes: [{ field: "endDate", oldValue: null, newValue: now }],
        changedBy,
        changedByName,
      });

      await updateDocById(POSITIONS, currentPosition.id, { status: "פנוי", updatedAt: now });
      await recordHistoryEntry({
        entityType: "position",
        entityId: currentPosition.id,
        entityLabel: currentPosition.role ?? "תקן",
        action: "update",
        changes: [{ field: "status", oldValue: currentPosition.status, newValue: "פנוי" }],
        changedBy,
        changedByName,
      });

      const newAssignmentId = await createDoc(COLLECTION, {
        employeeId: currentAssignment.employeeId,
        positionId: targetPosition.id,
        startDate,
        startDateText,
        endDate: null,
        employmentPercent: employmentPercent ?? targetPosition.employmentPercent,
        notes: notes ?? "",
        createdAt: now,
        updatedAt: now,
      });
      await recordHistoryEntry({
        entityType: "assignment",
        entityId: newAssignmentId,
        entityLabel: `${employeeLabel} → ${targetPosition.role ?? "תקן"}`,
        action: "create",
        changes: [],
        changedBy,
        changedByName,
      });

      await updateDocById(POSITIONS, targetPosition.id, { status: "מאויש", updatedAt: now });
      await recordHistoryEntry({
        entityType: "position",
        entityId: targetPosition.id,
        entityLabel: targetPosition.role ?? "תקן",
        action: "update",
        changes: [{ field: "status", oldValue: targetPosition.status, newValue: "מאויש" }],
        changedBy,
        changedByName,
      });

      return newAssignmentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION] });
      queryClient.invalidateQueries({ queryKey: [POSITIONS] });
    },
  });
}
