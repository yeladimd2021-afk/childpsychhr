import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "editor", "viewer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: userRoleSchema,
  active: z.boolean().default(true),
  createdAt: z.number(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
