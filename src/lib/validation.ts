import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .default("#2563eb"),
});

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  categoryId: z.string().trim().min(1).max(60).nullable().optional(),
});

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
