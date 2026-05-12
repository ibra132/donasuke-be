import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from './utils/error'
import { errorResponse } from './utils/response'
import { authRoute } from './routes/auth.route'
import { userRoute } from './routes/user.route'
import { adminRoute } from './routes/admin'
import { campaignRoute } from './routes/campaign.route'
import { donationRoute } from './routes/donation.route'
import { withdrawalRoute } from './routes/withdrawal.route'

const app = new Hono()

// ── Routes ──────────────────────────────────────────────
app.route('/api/auth', authRoute)
app.route('/api/users', userRoute)
app.route('/api/admin', adminRoute)
app.route('/api/campaigns', campaignRoute)
app.route('/api/donations', donationRoute)
app.route('/api/withdrawals', withdrawalRoute)

app.get('/health', (c) => c.json({ status: 'ok' }))

// ── Global error handler ─────────────────────────────────
app.onError((err, c) => {
  if (err instanceof AppError) {
    return errorResponse(c, err.message, err.statusCode, err.errors)
  }

  if (err instanceof ZodError) {
    return errorResponse(c, 'Validasi gagal', 400,
      err.issues.map((i) => ({ field: String(i.path[0] ?? ''), message: i.message }))
    )
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return errorResponse(c, 'Data sudah ada', 409)
    if (err.code === 'P2025') return errorResponse(c, 'Data tidak ditemukan', 404)
  }

  console.error(err)
  return errorResponse(c, 'Terjadi kesalahan pada server', 500)
})

// ── 404 handler ──────────────────────────────────────────
app.notFound((c) => errorResponse(c, 'Route tidak ditemukan', 404))

// ── Server ───────────────────────────────────────────────
serve(
  { fetch: app.fetch, port: Number(process.env.PORT) || 3001 },
  () => console.log(`Donasuke API running on http://localhost:${process.env.PORT || 3001}`)
)
