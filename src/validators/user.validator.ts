import { z } from "zod";

export const verifySchema = z.object({
  nik: z
    .string()
    .length(16, "NIK harus 16 digit")
    .regex(/^\d+$/, "NIK hanya boleh berisi angka"),
  ktpUrl: z.string().url("Format URL KTP tidak valid"),
});

export const rejectVerificationSchema = z.object({
  reason: z.string().min(10, "Alasan penolakan minimal 10 karakter"),
});

export const getVerificationsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
});
