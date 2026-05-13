import { z } from 'zod'

const CAMPAIGN_CATEGORIES = ['MEDIS', 'BENCANA', 'PENDIDIKAN', 'SOSIAL', 'LINGKUNGAN', 'HEWAN', 'LAINNYA'] as const

const MIN_DEADLINE_DAYS = 7

export const createCampaignSchema = z.object({
  title: z.string().min(10, 'Judul minimal 10 karakter').max(120, 'Judul maksimal 120 karakter'),
  category: z.enum(CAMPAIGN_CATEGORIES, { error: 'Kategori tidak valid' }),
  description: z.string().min(100, 'Deskripsi minimal 100 karakter').max(5000, 'Deskripsi maksimal 5000 karakter'),
  targetAmount: z.number().positive().min(1_000_000, 'Target minimal Rp 1.000.000').max(1_000_000_000, 'Target maksimal Rp 1.000.000.000'),
  deadline: z.coerce.date().refine(
    (d) => d > new Date(Date.now() + MIN_DEADLINE_DAYS * 24 * 60 * 60 * 1000),
    'Deadline minimal 7 hari dari sekarang'
  ),
  location: z.string().max(200, 'Lokasi maksimal 200 karakter').optional(),
}).strict()

export const updateCampaignSchema = z.object({
  title: z.string().min(10).max(120).optional(),
  description: z.string().min(100).max(5000).optional(),
  targetAmount: z.number().positive().min(1_000_000).max(1_000_000_000).optional(),
  deadline: z.coerce.date().refine(
    (d) => d > new Date(),
    'Deadline harus di masa depan'
  ).optional(),
  location: z.string().max(200).optional(),
}).strict()

export const rejectCampaignSchema = z.object({
  rejectReason: z.string().min(10, 'Alasan minimal 10 karakter').max(500, 'Alasan maksimal 500 karakter'),
})

export const addCampaignUpdateSchema = z.object({
  content: z.string().min(20, 'Update minimal 20 karakter').max(2000, 'Update maksimal 2000 karakter'),
})

export const getCampaignsQuerySchema = z.object({
  category: z.enum(CAMPAIGN_CATEGORIES).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'CLOSED', 'EXPIRED', 'REJECTED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
})
