import type { UserRole } from "@/lib/schemas/user";

export function canEdit(role: UserRole | undefined | null) {
  return role === "admin" || role === "editor";
}

export function canManageUsers(role: UserRole | undefined | null) {
  return role === "admin";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "מנהל מערכת",
  editor: "עורך",
  viewer: "צפייה בלבד",
};
