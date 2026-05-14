import { z } from "zod";

export const createWithdrawalSchema = z
  .object({
    campaignId: z.string().min(1, "Campaign ID diperlukan"),
    amount: z
      .number()
      .int("Nominal harus bilangan bulat")
      .min(10_000, "Minimal penarikan Rp 10.000"),
    bankName: z.string().min(1, "Nama bank diperlukan").max(100),
    bankAccount: z.string().min(1, "Nomor rekening diperlukan").max(50),
    accountHolder: z
      .string()
      .min(1, "Nama pemilik rekening diperlukan")
      .max(100),
    note: z.string().max(500).optional(),
  })
  .strict();

export const rejectWithdrawalSchema = z
  .object({
    note: z.string().min(1, "Alasan penolakan diperlukan").max(500),
  })
  .strict();

export const getWithdrawalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]).optional(),
});
