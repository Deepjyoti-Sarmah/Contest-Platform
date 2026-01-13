import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format"),
  password: z.string().min(6, "Password must be atleast 6 characters"),
  role: z.enum(["creator", "contestee"]).optional().default("contestee"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(6, "Password is required "),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
