# CLAUDE.md — Donasuke Backend Guide

Guide ini buat Claude Code waktu bantu develop **be_donasuke** (backend platform donasi).
Baca file ini dulu sebelum nulis kode apa pun di repo ini.

---

## 1. Tentang Project

**Donasuke** adalah platform donasi online (mirip Kitabisa / BenihBaik) sebagai project kuliah.
User bisa bikin campaign penggalangan dana, dan user lain bisa donasi via payment gateway.

### Core Flow
1. **User** register → verifikasi identitas (upload KTP) → bisa bikin campaign
2. **Campaign** dibuat (DRAFT) → submit → admin review → APPROVED/REJECTED → ACTIVE
3. **Donatur** donasi → bayar via Midtrans → status SUCCESS → `collectedAmount` update
4. **Campaign owner** request withdrawal → admin approve → admin transfer manual → mark PAID
5. **Admin** punya dashboard buat verifikasi user, approve campaign, approve withdrawal

---

## 2. Tech Stack

| Kategori | Tools |
|---|---|
| Runtime | Node.js |
| Framework | Hono |
| ORM | Prisma |
| Database | PostgreSQL (Supabase-hosted) |
| Storage | Supabase Storage (foto KTP, image campaign, dokumen, bukti transfer) |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Payment | Midtrans Snap |
| Env | dotenv |

**Catatan Supabase:**
- DB pakai Postgres Supabase (via `DATABASE_URL`), Prisma handle semua query.
- Storage Supabase pakai client `@supabase/supabase-js` di `src/lib/supabase.ts`.
- **TIDAK** pakai Supabase Auth. Auth manual via JWT + bcrypt.

### Bucket Storage Convention
| Bucket | Visibility | Isi |
|---|---|---|
| `ktp` | private | Foto KTP user (signed URL) |
| `avatar` | public | Avatar user |
| `campaign-images` | public | Cover image campaign |
| `campaign-docs` | private | Dokumen pendukung campaign |
| `withdrawal-proof` | private | Bukti transfer withdrawal |

---

## 3. Komunikasi & Behavior

- **Bahasa:** Indonesia casual. Pake "lu/gua" gapapa, gak perlu kaku.
- **Proaktivitas:** **Konfirmasi dulu sebelum nulis kode** kalo:
  - Mau ubah schema Prisma
  - Mau install package baru
  - Mau ubah file lebih dari 1 (refactor)
  - Implementasi ambigu / ada beberapa cara
- Boleh langsung eksekusi kalo: fix typo, tambah field validation yang jelas, atau task kecil yang udah eksplisit di-request.
- Kalo nemu masalah / inconsistency, kasih tau dulu sebelum auto-fix.
- Jangan auto-jalanin migration (`prisma migrate dev`) tanpa konfirmasi.

---

## 4. Folder Structure

```
src/
├── lib/                    # Singleton clients & utilities
│   ├── prisma.ts          # PrismaClient singleton
│   ├── supabase.ts        # Supabase client (storage)
│   ├── midtrans.ts        # Midtrans Snap client
│   ├── jwt.ts             # JWT sign/verify helper
│   └── bcrypt.ts          # Hash/compare helper
├── middleware/
│   ├── auth.middleware.ts        # Verify JWT, attach user to context
│   └── rbac.middleware.ts        # requirePermission('action:resource')
├── routes/                 # ROUTES = thin layer. Validate input → call service → return response
│   ├── auth.route.ts
│   ├── user.route.ts
│   ├── campaign.route.ts
│   ├── donation.route.ts
│   ├── withdrawal.route.ts
│   └── admin/
│       ├── index.ts
│       ├── verification.route.ts
│       ├── campaign.route.ts
│       └── withdrawal.route.ts
├── services/              # BUSINESS LOGIC lives here. Talk to Prisma, Supabase, Midtrans
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── campaign.service.ts
│   ├── donation.service.ts
│   ├── withdrawal.service.ts
│   └── storage.service.ts          # Upload/delete file via Supabase
├── validators/            # Zod schemas, pecah per-domain
│   ├── auth.validator.ts
│   ├── user.validator.ts
│   ├── campaign.validator.ts
│   ├── donation.validator.ts
│   └── withdrawal.validator.ts
├── utils/
│   ├── response.ts        # successResponse() / errorResponse() helpers
│   ├── error.ts           # AppError class
│   └── constants.ts       # PLATFORM_FEE_PERCENT, ADMIN_FEE, dll
├── types/
│   └── context.ts         # Hono context type extension (user, etc)
└── index.ts               # App entry, register routes & middleware
```

### Rule penting
- **Routes JANGAN akses Prisma langsung.** Selalu lewat service.
- **Validators JANGAN akses DB.** Cuma shape validation. Existence check di service.
- **Services boleh saling call** tapi hindari circular dependency. Kalo ribet, ekstrak ke helper.
- Satu file = satu tanggung jawab. Jangan numpuk semua di `index.ts`.

---

## 5. Naming Convention

| Item | Convention | Contoh |
|---|---|---|
| File | `kebab-case.{layer}.ts` | `campaign.service.ts`, `auth.validator.ts` |
| Folder | `kebab-case` | `admin/`, `middleware/` |
| Variable / function | `camelCase` | `getUserById`, `collectedAmount` |
| Class | `PascalCase` | `AppError`, `CampaignService` |
| Constant | `SCREAMING_SNAKE_CASE` | `PLATFORM_FEE_PERCENT`, `JWT_EXPIRES_IN` |
| DB field | `camelCase` (sesuai Prisma) | `createdAt`, `targetAmount` |
| Route path | `kebab-case`, plural untuk resource | `/campaigns/:id`, `/withdrawal-requests` |
| Zod schema | `xxxSchema` | `createCampaignSchema`, `loginSchema` |
| Service method | verb-first | `createCampaign`, `findActiveCampaigns` |

---

## 6. Database & Prisma Rules

### Prinsip
- **Single source of truth:** Prisma schema.
- Selalu pakai `prisma` singleton dari `src/lib/prisma.ts`. **Jangan `new PrismaClient()` di mana-mana.**
- Pakai `select` / `include` eksplisit — jangan return semua field default (terutama `password`, `nik`, `ktpUrl`).
- Untuk operation yang ubah state finansial (donation success, withdrawal), **WAJIB pakai `prisma.$transaction`**.

### Schema Improvement Plan (TODO)
Schema sekarang masih bisa dibagusin. Saat ngerjain task terkait, sekalian propose perubahan ini (satu-satu, jangan sekaligus):

1. **Tambah `updatedAt`** ke semua model utama (`User`, `Campaign`, `Donation`, `Withdrawal`).
2. **Tambah index** untuk query yang sering:
   - `Campaign`: `@@index([status])`, `@@index([category])`, `@@index([userId])`
   - `Donation`: `@@index([campaignId, status])`, `@@index([userId])`
   - `Withdrawal`: `@@index([campaignId])`, `@@index([status])`
3. **Guest donation:** `Donation.userId` jadi optional, atau bikin pattern "guest user" (decide saat implementasi donation).
4. **Soft delete** (opsional): tambah `deletedAt` di `Campaign` & `User` kalo perlu.
5. **`Campaign.collectedAmount` consistency:** WAJIB update di dalam transaction saat Donation berubah ke SUCCESS. Jangan trust nilai cached blindly — sediakan service `recalculateCollectedAmount(campaignId)` buat recovery.

**Aturan:** Setiap kali mau ubah schema → konfirmasi dulu → kalo OK, edit `schema.prisma` → suruh user run `npx prisma migrate dev --name <nama>` sendiri.

### Migration
- **JANGAN** auto-run migrate. Cukup edit schema, kasih command yang user perlu jalanin.
- Nama migration deskriptif: `add_updatedat_to_models`, bukan `update_schema`.

---

## 7. API Response Standard

Format response selalu konsisten. Pakai helper `src/utils/response.ts`.

### Success
```json
{
  "success": true,
  "message": "Campaign berhasil dibuat",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Email tidak valid" }
  ]
}
```

### HTTP Status Convention
| Status | Kapan dipakai |
|---|---|
| 200 | Success (GET, PATCH, PUT) |
| 201 | Resource created (POST) |
| 400 | Validation error / bad request |
| 401 | Unauthenticated (no token / invalid token) |
| 403 | Authenticated tapi gak punya permission |
| 404 | Resource not found |
| 409 | Conflict (email udah dipake, duplicate, dll) |
| 422 | Business logic error (e.g. campaign udah expired) |
| 500 | Unexpected server error |

---

## 8. Auth & RBAC

### JWT
- Access token doang (no refresh dulu). Expiry: 7 hari (bisa diubah via `JWT_EXPIRES_IN`).
- Payload: `{ userId, roles: string[], permissions: string[] }` — embed permissions biar gak query DB tiap request.
- Secret di `JWT_SECRET` (env).

### Middleware Pattern
```ts
// Protected route
app.use('/campaigns/*', authMiddleware)

// RBAC granular
app.post('/admin/campaigns/:id/approve',
  authMiddleware,
  requirePermission('campaign:approve'),
  handler
)
```

### Permission Naming
Format: `resource:action`. Contoh:
- `campaign:create`, `campaign:approve`, `campaign:reject`
- `user:verify`, `user:ban`
- `withdrawal:approve`, `withdrawal:reject`, `withdrawal:mark-paid`
- `donation:refund`

### Default Roles (di seed)
- `USER` — basic user, bisa donasi & bikin campaign (kalo verified)
- `ADMIN` — full access ke admin panel
- (Opsional: `MODERATOR` — subset ADMIN, cuma review campaign)

---

## 9. Validation (Zod)

- Satu file per domain di `src/validators/`.
- Schema di-export named: `createCampaignSchema`, `updateCampaignSchema`, dst.
- Pakai `.strict()` kalo mau reject unknown fields.
- Pake middleware Hono `zValidator('json', schema)` dari `@hono/zod-validator`.
- Untuk error response, transform Zod error → format `errors[]` standard di global handler.

```ts
// Contoh
export const createCampaignSchema = z.object({
  title: z.string().min(10).max(120),
  category: z.enum(['MEDIS', 'BENCANA', 'PENDIDIKAN', 'SOSIAL']),
  targetAmount: z.number().positive().min(100_000),
  deadline: z.coerce.date().refine(d => d > new Date(), 'Deadline harus di masa depan'),
  // ...
})
```

---

## 10. Error Handling

### Custom Error Class
```ts
// src/utils/error.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message)
  }
}
```

### Throw Pattern di Service
```ts
if (!campaign) throw new AppError(404, 'Campaign tidak ditemukan')
if (campaign.status !== 'ACTIVE') throw new AppError(422, 'Campaign tidak aktif')
```

### Global Handler di `src/index.ts`
- Tangkap `AppError` → response sesuai statusCode.
- Tangkap `ZodError` → 400 + transformed errors.
- Tangkap `Prisma.PrismaClientKnownRequestError` → map kode P2002 ke 409, dll.
- Sisanya → 500 + log (jangan expose stack ke client di production).

---

## 11. Domain-Specific Rules

### Donation Flow
1. User pilih campaign + nominal → POST `/donations`
2. Service:
   - Validate campaign masih ACTIVE & belum lewat deadline
   - Hitung `platformFee` (5% atau sesuai `PLATFORM_FEE_PERCENT`)
   - Create `Donation` status PENDING
   - Generate Midtrans Snap token → simpan ke `paymentToken`
   - Return token ke frontend
3. Frontend buka Snap popup → user bayar
4. Midtrans webhook hit `/webhooks/midtrans`:
   - Verify signature pake `MIDTRANS_SERVER_KEY`
   - Kalo `settlement` / `capture`: update Donation jadi SUCCESS, **dalam transaction** increment `Campaign.collectedAmount`
   - Kalo `expire` / `cancel` / `deny`: update jadi FAILED/EXPIRED

**Idempotency:** Webhook bisa kena dua kali. Cek dulu kalo Donation udah SUCCESS, skip.

### Withdrawal Flow
1. Owner request → POST `/withdrawals` dengan nominal & data bank
2. Validate: `amount <= (collectedAmount - sum withdrawal yg udah APPROVED/PAID)`
3. Status PENDING → admin review
4. Admin APPROVE → admin transfer manual ke bank → upload `proofUrl` → mark PAID
5. Hitung `adminFee` di service (constant atau persen)

### Campaign Status Transition
```
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → CLOSED/EXPIRED
                      ↘ REJECTED
```
- Cuma owner yang bisa submit DRAFT → PENDING_REVIEW
- Cuma admin yang bisa APPROVED/REJECTED
- ACTIVE otomatis pas approved (atau jadwalin via cron buat EXPIRED kalo deadline lewat)

### User Verification Flow
1. User upload KTP → POST `/users/me/verification` (multipart: nik, ktpFile)
2. File upload ke bucket `ktp` (private) → simpan path ke `User.ktpUrl`
3. Status `PENDING` → admin review di `/admin/verification`
4. Admin APPROVED → user bisa bikin campaign
5. Admin REJECTED + `verificationRejectReason` → user bisa re-submit

**Aturan:** User yang belum APPROVED **tidak bisa** create campaign atau withdrawal.

---

## 12. Security Checklist

Setiap PR / task wajib di-cek:

- [ ] Password selalu di-hash pake bcrypt (cost ≥ 10). **Jangan pernah return `password`** dari API.
- [ ] `nik` dan `ktpUrl` cuma boleh diakses owner sendiri atau admin dengan permission `user:verify`.
- [ ] File upload validate MIME type & ukuran (max 5MB untuk image, 10MB untuk doc).
- [ ] Midtrans webhook **WAJIB** verify signature. Jangan trust raw payload.
- [ ] SQL injection: Prisma udah safe by default, tapi **jangan pakai `$queryRawUnsafe`**.
- [ ] Rate limiting di endpoint sensitif (login, register, donation create) — bisa pake middleware sederhana.
- [ ] Jangan log `password`, `JWT_SECRET`, `MIDTRANS_SERVER_KEY`, atau token user di console.
- [ ] CORS configure proper, jangan `*` di production.

---

## 13. Environment Variables

File `.env` minimal:
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...           # untuk Prisma migrate kalo pake Supabase pooler

JWT_SECRET=...
JWT_EXPIRES_IN=7d

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...         # service role untuk upload server-side

MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=false

PLATFORM_FEE_PERCENT=5
WITHDRAWAL_ADMIN_FEE=5000

PORT=3000
NODE_ENV=development
```

**Aturan:** Setiap nambah env baru, update `.env.example` juga dan kasih tau user.

---

## 14. Git & Commit Convention

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- Contoh: `feat(campaign): add approval endpoint`, `fix(donation): handle webhook idempotency`
- Branch naming: `feature/campaign-approval`, `fix/donation-webhook`

---

## 15. Things to AVOID

❌ `new PrismaClient()` di luar `src/lib/prisma.ts`
❌ Business logic di route handler
❌ DB call di validator
❌ Return field sensitif (`password`, `nik`, raw `ktpUrl`)
❌ Auto-run `prisma migrate` tanpa konfirmasi
❌ Install package tanpa konfirmasi
❌ Hardcode angka magic (fee, expiry, limit) → masukin ke `constants.ts` atau env
❌ `any` type di TypeScript — pake `unknown` + narrowing, atau bikin type proper
❌ Update `collectedAmount` di luar transaction
❌ Trust webhook payload tanpa verify signature
❌ Pake `$queryRawUnsafe`
❌ Console.log sensitive data

---

## 16. Common Commands

```bash
# Dev
npm run dev

# Prisma
npx prisma generate                       # setelah edit schema
npx prisma migrate dev --name <nama>      # bikin migration baru
npx prisma studio                          # GUI buat liat data
npx prisma db seed                         # jalanin seed

# Lint / type check (kalo udah di-setup)
npm run typecheck
```

---

## 17. Saat Mulai Task Baru — Checklist Claude Code

Sebelum nulis kode:
1. Baca file ini ✅
2. Liat folder structure & file existing — jangan duplicate
3. Cek schema Prisma — apakah model yang dipake udah ada / butuh tambahan
4. Identifikasi: ini layer mana? (route / service / validator / middleware)
5. **Konfirmasi ke user** kalo:
   - Schema perlu diubah
   - Perlu install package baru
   - Ada > 1 cara implement
   - Mau refactor file existing
6. Setelah konfirmasi → eksekusi → kasih ringkasan apa yang berubah & next step buat user (e.g. "run `npx prisma migrate dev`")

---

_Last updated: ikutin tanggal commit. Update file ini kalo ada convention baru yang disepakati._
