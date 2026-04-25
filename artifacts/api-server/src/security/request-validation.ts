import { z } from "zod";

export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const tokenSchema = z.string().trim().min(20).max(512);

export const requestIdSchema = z.string().trim().min(1).max(128);

export const strictStringArray = (maxItems: number, maxLength = 64) =>
  z
    .array(z.string().trim().min(1).max(maxLength))
    .max(maxItems)
    .transform((values) => Array.from(new Set(values)));
