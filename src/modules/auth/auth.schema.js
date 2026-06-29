import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Email/Username required").optional(),
  password: z.string().min(1, "Password required"),
}).refine((data) => data.username, {
  message: "Email or username is required",
  path: ["username"],
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, "Current password required"),
  new_password: z.string().min(6, "New password must be at least 6 characters"),
});
