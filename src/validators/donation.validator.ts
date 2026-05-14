import { z } from "zod";

export const createDonationSchema = z
  .object({
    campaignId: z.string().min(1, "Campaign ID diperlukan"),
    amount: z
      .number()
      .int("Nominal harus bilangan bulat")
      .min(10_000, "Donasi minimal Rp 10.000"),
    isAnonymous: z.boolean().default(false),
    message: z.string().max(500, "Pesan maksimal 500 karakter").optional(),
  })
  .strict();

export const getDonationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const getCampaignDonationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["newest", "oldest", "largest", "smallest"]).default("newest"),
});
