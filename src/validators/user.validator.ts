import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(100, "Nama maksimal 100 karakter")
      .optional(),
    bio: z.string().max(500, "Bio maksimal 500 karakter").optional(),
  })
  .strict();

export const verificationSchema = z
  .object({
    nik: z
      .string()
      .length(16, "NIK harus 16 digit angka")
      .regex(/^\d+$/, "NIK harus 16 digit angka"),
  })
  .strict();

// Dipakai admin
export const rejectVerificationSchema = z.object({
  reason: z.string().min(10, "Alasan minimal 10 karakter"),
});

export const getVerificationsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
