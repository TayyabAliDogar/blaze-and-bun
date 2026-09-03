import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(255),
  phone: z.string().trim().max(30).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address").max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required").max(512),
  password: signupSchema.shape.password,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;