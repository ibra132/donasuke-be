# Donasuke — Claude Code Prompt Playbook

Dokumen ini berisi kumpulan prompt siap pakai untuk Claude Code.
Jalankan **secara berurutan** per fase. Copy-paste satu prompt per sesi.

### Cara pakai
1. Buka Claude Code di root folder `be_donasuke/`
2. Pastiin Claude Code udah baca `CLAUDE.md` (biasanya otomatis)
3. Copy prompt di bawah → paste ke Claude Code → tunggu konfirmasi sebelum eksekusi
4. Selesaikan satu prompt sampai tuntas sebelum lanjut ke prompt berikutnya
5. Kalo Claude Code nanya sesuatu yang lo ragu, jawab dulu sebelum bilang "lanjut"

### Legend
- 🔴 **STOP** — Jangan lanjut ke prompt berikutnya sebelum task ini selesai 100%
- 🟡 **CHECK** — Ada step manual yang harus lo lakuin sendiri (migrate, test, dll)
- 🟢 **AUTO** — Claude Code bisa eksekusi sendiri, minimal interaction

---

## FASE 0 — Foundation

> Setup semua fondasi project sebelum nulis satu pun business logic.
> Fase ini harus selesai 100% sebelum lanjut ke fase lain.

---

### [0.1] Setup folder structure 🟢

```
Baca CLAUDE.md terlebih dahulu.

Buatkan struktur folder lengkap untuk project ini sesuai konvensi di CLAUDE.md section 4.
Yang perlu dibuat:
- src/lib/ (kosong dulu, isi nanti)
- src/middleware/ (sudah ada auth.middleware.ts, jangan diubah dulu)
- src/services/
- src/validators/ (sudah ada index.ts, nanti kita pecah per domain)
- src/utils/
- src/types/

Untuk setiap folder, buatkan file .gitkeep agar folder ter-commit ke git.
Jangan buat file implementasi dulu — hanya struktur folder.

Setelah selesai, tampilkan tree struktur folder src/ yang sudah dibuat.
```

---

### [0.2] Setup utility: response helper & AppError 🟢

```
Baca CLAUDE.md section 7 (API Response Standard) dan section 10 (Error Handling).

Buatkan dua file berikut:

1. src/utils/response.ts
   - Export fungsi successResponse(c, data, message, status?)
   - Export fungsi errorResponse(c, message, status, errors?)
   - Gunakan Hono Context type
   - Format response sesuai CLAUDE.md section 7

2. src/utils/error.ts
   - Export class AppError extends Error
   - Constructor: (statusCode: number, message: string, errors?: Array<{field: string, message: string}>)

3. src/utils/constants.ts
   - PLATFORM_FEE_PERCENT = ambil dari env PLATFORM_FEE_PERCENT, default 5
   - WITHDRAWAL_ADMIN_FEE = ambil dari env WITHDRAWAL_ADMIN_FEE, default 5000
   - JWT_EXPIRES_IN = ambil dari env JWT_EXPIRES_IN, default '7d'

Konfirmasi struktur type sebelum menulis kode.
```

---

### [0.3] Setup lib: Prisma singleton 🟢

```
Baca CLAUDE.md section 6 (Database & Prisma Rules).

Buatkan src/lib/prisma.ts:
- Export PrismaClient singleton
- Pattern: cek apakah global.__prisma sudah ada (untuk hot reload di dev)
- Di production, langsung new PrismaClient()
- Tambahkan komentar kenapa pakai singleton pattern

Jangan install package baru — Prisma sudah ada di package.json.
```

---

### [0.4] Setup lib: Supabase client 🟢

```
Baca CLAUDE.md section 2 (Tech Stack) bagian Supabase.

Buatkan src/lib/supabase.ts:
- Import createClient dari @supabase/supabase-js
- Gunakan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dari env
- Export satu supabase client (service role, untuk server-side upload)
- Tambahkan komentar: "Gunakan service role key karena upload dilakukan server-side. JANGAN expose ke client."

Cek dulu apakah @supabase/supabase-js sudah ada di package.json.
Jika belum, konfirmasi ke saya sebelum install.
```

---

### [0.5] Setup lib: JWT helper 🟢

```
Baca CLAUDE.md section 8 (Auth & RBAC).

Buatkan src/lib/jwt.ts:
- Import jsonwebtoken
- Export fungsi signToken(payload: JwtPayload): string
  - payload berisi: { userId, roles: string[], permissions: string[] }
  - Gunakan JWT_SECRET dari env
  - Expiry dari JWT_EXPIRES_IN (constants)
- Export fungsi verifyToken(token: string): JwtPayload
  - Throw AppError(401, 'Token tidak valid') jika gagal verify

Buatkan src/types/context.ts:
- Define interface JwtPayload: { userId: string, roles: string[], permissions: string[] }
- Define HonoVariables type untuk Hono context (user: JwtPayload)

Konfirmasi type definition sebelum menulis implementasi.
```

---

### [0.6] Setup lib: bcrypt helper 🟢

```
Buatkan src/lib/bcrypt.ts:
- Export fungsi hashPassword(password: string): Promise<string>
  - Cost factor: 12
- Export fungsi comparePassword(plain: string, hashed: string): Promise<boolean>

Simpel saja, tidak perlu lebih dari ini.
```

---

### [0.7] Setup lib: Midtrans client 🟢

```
Baca CLAUDE.md section 11 (Domain-Specific Rules) bagian Donation Flow.

Buatkan src/lib/midtrans.ts:
- Install package midtrans-client jika belum ada (konfirmasi dulu)
- Setup Snap client dengan MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY dari env
- isProduction: baca dari env MIDTRANS_IS_PRODUCTION (string 'true'/'false') → convert ke boolean
- Export snap client

Konfirmasi apakah midtrans-client sudah ada di package.json sebelum install.
```

---

### [0.8] Setup storage service 🟢

```
Baca CLAUDE.md section 2 bagian Bucket Storage Convention.

Buatkan src/services/storage.service.ts:
- Import supabase client dari src/lib/supabase.ts
- Export fungsi uploadFile(bucket: string, path: string, file: File | Buffer, contentType: string): Promise<string>
  - Upload ke Supabase Storage
  - Return public URL (untuk bucket public) atau path (untuk bucket private)
  - Throw AppError(500, 'Gagal upload file') jika error
- Export fungsi deleteFile(bucket: string, path: string): Promise<void>
- Export fungsi getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string>
  - Untuk file di bucket private (ktp, campaign-docs, withdrawal-proof)

Bucket names sebagai konstanta di atas file:
const BUCKETS = {
  KTP: 'ktp',
  AVATAR: 'avatar',
  CAMPAIGN_IMAGES: 'campaign-images',
  CAMPAIGN_DOCS: 'campaign-docs',
  WITHDRAWAL_PROOF: 'withdrawal-proof',
} as const

Export BUCKETS juga.
```

---

### [0.9] Setup middleware: auth & RBAC 🔴

```
Baca CLAUDE.md section 8 (Auth & RBAC) dan section 10 (Error Handling).

Ada file src/middleware/auth.middleware.ts yang sudah ada.
Tampilkan dulu isi file tersebut ke saya, jangan langsung edit.
Setelah saya lihat, kita diskusikan apakah perlu diubah atau cukup dilengkapi.

Setelah auth middleware beres, buatkan src/middleware/rbac.middleware.ts:
- Export fungsi requirePermission(permission: string): MiddlewareHandler
  - Ambil user dari Hono context (sudah di-set oleh auth middleware)
  - Cek apakah user.permissions include permission yang diminta
  - Jika tidak: throw AppError(403, 'Akses ditolak')
- Export fungsi requireRole(role: string): MiddlewareHandler
  - Cek user.roles include role yang diminta
  - Jika tidak: throw AppError(403, 'Akses ditolak')

Konfirmasi type Hono context yang dipakai sebelum nulis kode.
```

---

### [0.10] Setup global error handler & app entry 🔴

```
Baca CLAUDE.md section 10 (Error Handling) dan section 7 (API Response Standard).

Update src/index.ts (atau buat jika belum ada):
1. Inisialisasi Hono app dengan type HonoVariables dari src/types/context.ts
2. Setup global error handler menggunakan app.onError():
   - Tangkap AppError → return errorResponse dengan statusCode dan message
   - Tangkap ZodError → return 400 + transform issues ke format errors[]
   - Tangkap PrismaClientKnownRequestError:
     - P2002 (unique constraint) → 409 'Data sudah ada'
     - P2025 (not found) → 404 'Data tidak ditemukan'
   - Sisanya → 500, jangan expose error detail, hanya log ke console
3. Setup 404 handler: app.notFound()
4. Tambahkan route placeholder: app.get('/health', (c) => c.json({ status: 'ok' }))
5. Export app (untuk testing) dan jalankan serve()

Tampilkan isi src/index.ts yang ada sekarang sebelum edit.
Konfirmasi struktur error handler sebelum implementasi.
```

---

### [0.11] Verifikasi Fase 0 🟡

```
Lakukan verifikasi foundation sebelum kita lanjut ke Fase 1.

Tampilkan:
1. Tree struktur src/ lengkap
2. List semua file yang sudah dibuat di fase ini
3. Cek apakah ada circular import atau dependency yang janggal
4. Cek apakah semua env variable yang dipakai sudah terdokumentasi

Jangan jalankan apapun — hanya review dan tampilkan hasilnya.
```

> 🟡 **Manual step:** Setelah fase 0 selesai, jalankan `npm run dev` dan pastiin server nyala tanpa error. Cek endpoint `/health` via browser atau curl.

---

---

## FASE 1 — Auth

---

### [1.1] Auth validator 🟢

```
Baca CLAUDE.md section 9 (Validation).

Buatkan src/validators/auth.validator.ts:

1. registerSchema:
   - name: string, min 3, max 100
   - email: string, email format
   - password: string, min 8, max 100
     - Harus ada: huruf besar, huruf kecil, angka
     - Custom message yang informatif jika gagal

2. loginSchema:
   - email: string, email format
   - password: string, min 1

Gunakan .strict() pada semua schema.
Export named: registerSchema, loginSchema.
```

---

### [1.2] Auth service 🔴

```
Baca CLAUDE.md section 6 (Database) dan section 8 (Auth).

Buatkan src/services/auth.service.ts:

1. register(data: RegisterInput): Promise<{ user, token }>
   - Cek email sudah dipakai → throw AppError(409, 'Email sudah terdaftar')
   - Hash password dengan bcrypt helper
   - Create user di DB
   - Assign role 'USER' ke user baru (cari role by name, throw jika tidak ada)
   - Generate token dengan permissions dari role USER
   - Return user (TANPA password) dan token

2. login(data: LoginInput): Promise<{ user, token }>
   - Cari user by email → throw AppError(401, 'Email atau password salah') jika tidak ada
   - Compare password → throw AppError(401, 'Email atau password salah') jika salah
   - Ambil roles dan permissions user dari DB (include UserRole → Role → RolePermission → Permission)
   - Generate token
   - Return user (TANPA password) dan token

Helper private:
- getUserWithRolesAndPermissions(userId): query user beserta roles dan permissions-nya

PENTING:
- Selalu pakai select eksplisit, jangan return semua field
- Jangan pernah return field password

Konfirmasi query structure untuk ambil permissions sebelum implementasi.
```

---

### [1.3] Auth route 🟢

```
Baca CLAUDE.md section 5 (Naming Convention) dan section 7 (API Response Standard).

Update/buat src/routes/auth.route.ts:

POST /auth/register
- Validate body dengan registerSchema (zValidator)
- Panggil authService.register()
- Return successResponse 201 dengan { user, token }

POST /auth/login
- Validate body dengan loginSchema
- Panggil authService.login()
- Return successResponse 200 dengan { user, token }

GET /auth/me
- Gunakan authMiddleware
- Query user dari DB by userId (dari context)
- Return user data tanpa password, beserta roles

Route di-export sebagai Hono instance, di-mount di index.ts dengan prefix /auth.
Tampilkan cara mount di index.ts juga.
```

---

### [1.4] Seed: roles & permissions 🔴

```
Baca CLAUDE.md section 8 bagian Default Roles.

Update prisma/seed.ts:

Seed data berikut (gunakan upsert agar idempotent):

Permissions (sesuai konvensi resource:action di CLAUDE.md):
Kelompok campaign: campaign:create, campaign:submit, campaign:approve, campaign:reject, campaign:delete
Kelompok user: user:verify, user:reject-verification, user:ban
Kelompok withdrawal: withdrawal:request, withdrawal:approve, withdrawal:reject, withdrawal:mark-paid
Kelompok donation: donation:create, donation:refund
Kelompok admin: admin:access, report:view, report:action

Roles:
- USER: dapat permissions → campaign:create, campaign:submit, withdrawal:request, donation:create
- ADMIN: dapat SEMUA permissions di atas

Tampilkan daftar lengkap permissions yang akan di-seed dan minta konfirmasi sebelum tulis kode.
```

> 🟡 **Manual step:** Setelah seed.ts selesai, jalankan `npx prisma db seed` dan verifikasi data masuk via Prisma Studio (`npx prisma studio`).

---

### [1.5] Verifikasi Fase 1 🟡

```
Verifikasi implementasi auth sebelum lanjut.

Buatkan checklist verifikasi dan cek satu per satu:
1. Apakah password di-hash sebelum disimpan?
2. Apakah response register/login tidak mengandung field password?
3. Apakah token payload berisi userId, roles, dan permissions?
4. Apakah error message login tidak membedakan "email tidak ada" vs "password salah"? (security: sama-sama '401 Email atau password salah')
5. Apakah role USER otomatis di-assign saat register?
6. Apakah ada potensi race condition saat assign role (dua request register bersamaan)?

Untuk poin 6, jelaskan apakah perlu di-wrap dalam transaction.
```

> 🟡 **Manual step:** Test manual via curl atau Hoppscotch:
> - POST `/auth/register` → expect 201 + token
> - POST `/auth/login` → expect 200 + token
> - GET `/auth/me` dengan Bearer token → expect user data

---

---

## FASE 2 — User

---

### [2.1] User validator 🟢

```
Buatkan src/validators/user.validator.ts:

1. updateProfileSchema:
   - name: string, min 3, max 100, optional
   - bio: string, max 500, optional
   - Gunakan .partial()

2. uploadAvatarSchema: (untuk validasi file, bukan JSON)
   - Tidak perlu Zod schema, validasi di service:
     - MIME type harus image/jpeg atau image/png
     - Max size: 2MB
   - Cukup export konstanta: ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE

3. verificationSchema:
   - nik: string, exactly 16 karakter, hanya angka
   - Custom message: 'NIK harus 16 digit angka'
```

---

### [2.2] User service 🔴

```
Baca CLAUDE.md section 11 bagian User Verification Flow dan section 12 (Security Checklist).

Buatkan src/services/user.service.ts:

1. getProfile(userId: string)
   - Return user tanpa password, tanpa nik, tanpa ktpUrl
   - Include roles

2. updateProfile(userId: string, data: UpdateProfileInput)
   - Update name dan/atau bio
   - Return user updated (tanpa sensitive fields)

3. uploadAvatar(userId: string, file: File)
   - Validasi MIME type dan ukuran
   - Upload ke bucket 'avatar' via storageService.uploadFile()
   - Path naming: avatars/{userId}/{timestamp}.{ext}
   - Update User.avatar dengan URL hasil upload
   - Jika user sudah punya avatar lama, hapus file lama dari storage
   - Return URL avatar baru

4. submitVerification(userId: string, data: { nik: string }, ktpFile: File)
   - Cek jika user sudah APPROVED → throw AppError(422, 'Akun sudah terverifikasi')
   - Cek jika user sudah PENDING → throw AppError(422, 'Verifikasi sedang dalam proses review')
   - Validasi ktpFile: MIME image/jpeg atau image/png, max 5MB
   - Upload KTP ke bucket 'ktp' (private)
   - Path: ktp/{userId}/{timestamp}.{ext}
   - Update user: nik, ktpUrl, verificationStatus = PENDING, reset verificationRejectReason = null
   - Return user updated (tanpa password, return nik dan verificationStatus saja — bukan ktpUrl raw)

PENTING: ktpUrl jangan pernah di-return ke client secara langsung (itu path private storage).
Konfirmasi field apa saja yang boleh di-return dari user profile sebelum implementasi.
```

---

### [2.3] User route 🟢

```
Update/buat src/routes/user.route.ts:

Semua route di bawah pakai authMiddleware.

GET /users/me
- Panggil userService.getProfile(userId)
- Return 200 + data user

PATCH /users/me
- Validate body dengan updateProfileSchema
- Panggil userService.updateProfile()
- Return 200 + user updated

POST /users/me/avatar
- Ambil file dari multipart/form-data (field name: 'avatar')
- Panggil userService.uploadAvatar()
- Return 200 + { avatarUrl }

POST /users/me/verification
- Ambil body: nik (text field), file: ktpFile (multipart)
- Validate nik dengan verificationSchema
- Panggil userService.submitVerification()
- Return 200 + { message: 'Verifikasi berhasil disubmit, menunggu review admin' }

Mount di index.ts dengan prefix /users.
```

---

---

## FASE 3 — Campaign

---

### [3.1] Campaign validator 🟢

```
Buatkan src/validators/campaign.validator.ts:

1. createCampaignSchema:
   - title: string, min 10, max 120
   - category: z.enum(['MEDIS', 'BENCANA', 'PENDIDIKAN', 'SOSIAL', 'LINGKUNGAN', 'HEWAN', 'LAINNYA'])
   - description: string, min 100, max 5000
   - targetAmount: number, positive, min 1.000.000, max 1.000.000.000
   - deadline: z.coerce.date(), harus lebih dari 7 hari dari sekarang
   - location: string, max 200, optional

2. updateCampaignSchema:
   - Sama seperti create, tapi semua optional (.partial())
   - Kecuali category tidak bisa diubah setelah submit

3. rejectCampaignSchema (untuk admin):
   - rejectReason: string, min 10, max 500

4. addCampaignUpdateSchema:
   - content: string, min 20, max 2000
```

---

### [3.2] Campaign service (CRUD & lifecycle) 🔴

```
Baca CLAUDE.md section 11 bagian Campaign Status Transition.

Buatkan src/services/campaign.service.ts:

1. createCampaign(userId: string, data: CreateCampaignInput, imageFile?: File)
   - Cek user.verificationStatus === 'APPROVED' → jika tidak, throw AppError(403, 'Akun belum terverifikasi')
   - Upload imageFile jika ada ke bucket 'campaign-images'
   - Create campaign dengan status DRAFT
   - Return campaign

2. getCampaigns(filter: { category?, status?, search?, page?, limit? })
   - Default: status ACTIVE, page 1, limit 12
   - Include user (name, avatar saja), exclude sensitive fields
   - Return { data: campaigns[], total, page, limit }

3. getCampaignById(id: string)
   - Include user (name, avatar), donations count, latest updates
   - Return campaign detail

4. updateCampaign(campaignId: string, userId: string, data: UpdateCampaignInput, imageFile?: File)
   - Cek campaign milik userId → throw AppError(403) jika bukan
   - Cek status masih DRAFT → throw AppError(422, 'Campaign tidak bisa diedit setelah disubmit')
   - Upload image baru jika ada, hapus image lama
   - Return campaign updated

5. submitCampaign(campaignId: string, userId: string)
   - Cek kepemilikan
   - Cek status === DRAFT → jika tidak, throw AppError(422, ...)
   - Update status → PENDING_REVIEW
   - Return campaign

6. deleteCampaign(campaignId: string, userId: string)
   - Cek kepemilikan
   - Cek status DRAFT atau REJECTED → jika tidak, throw AppError(422, 'Campaign aktif tidak bisa dihapus')
   - Delete campaign
   - Hapus image dari storage jika ada

7. addCampaignDocument(campaignId: string, userId: string, docFile: File, documentType: string)
   - Cek kepemilikan dan status masih DRAFT
   - Upload ke bucket 'campaign-docs'
   - Create CampaignDocument record

8. addCampaignUpdate(campaignId: string, userId: string, content: string)
   - Cek kepemilikan
   - Cek status ACTIVE → jika tidak, throw AppError(422, ...)
   - Create CampaignUpdate

Konfirmasi query structure getCampaigns (filter, pagination) sebelum implementasi.
```

---

### [3.3] Campaign service (admin actions) 🔴

```
Tambahkan ke src/services/campaign.service.ts fungsi-fungsi untuk admin:

1. getPendingCampaigns(page?, limit?)
   - Filter status PENDING_REVIEW
   - Include user detail (name, verificationStatus)
   - Return paginated list

2. approveCampaign(campaignId: string)
   - Cek status === PENDING_REVIEW
   - Update status → APPROVED (dan langsung ACTIVE)
   - Return campaign

3. rejectCampaign(campaignId: string, rejectReason: string)
   - Cek status === PENDING_REVIEW
   - Update status → REJECTED, set rejectReason
   - Return campaign

4. closeCampaign(campaignId: string)
   - Update status → CLOSED (admin bisa force close)
   - Return campaign

Konfirmasi apakah APPROVED dan ACTIVE langsung atau APPROVED dulu baru ACTIVE dijadwalkan.
(Rekomendasi: langsung ACTIVE setelah admin approve, bisa diubah nanti)
```

---

### [3.4] Campaign route 🟢

```
Buat src/routes/campaign.route.ts (public + user routes):

Public (no auth needed):
GET /campaigns → getCampaigns dengan filter query params
GET /campaigns/:id → getCampaignById

Protected (authMiddleware):
POST /campaigns → requirePermission('campaign:create') → createCampaign
PATCH /campaigns/:id → cek ownership di service → updateCampaign
DELETE /campaigns/:id → cek ownership di service → deleteCampaign
POST /campaigns/:id/submit → requirePermission('campaign:submit') → submitCampaign
POST /campaigns/:id/documents → upload dokumen pendukung
POST /campaigns/:id/updates → addCampaignUpdate

Saved campaigns:
POST /campaigns/:id/save → toggle save campaign
GET /campaigns/saved → list saved campaigns milik user

Mount di index.ts dengan prefix /campaigns.
```

---

### [3.5] Admin campaign route 🟢

```
Buat src/routes/admin/campaign.route.ts:

Semua route: authMiddleware + requirePermission('admin:access')

GET /admin/campaigns → getPendingCampaigns (query: status filter)
GET /admin/campaigns/:id → getCampaignById (sama dengan public tapi bisa lihat semua status)
POST /admin/campaigns/:id/approve → requirePermission('campaign:approve') → approveCampaign
POST /admin/campaigns/:id/reject → requirePermission('campaign:reject') → rejectCampaign, body: rejectCampaignSchema
POST /admin/campaigns/:id/close → closeCampaign

Update src/routes/admin/index.ts untuk mount route ini.
```

---

---

## FASE 4 — Donation

---

### [4.1] Donation validator 🟢

```
Buatkan src/validators/donation.validator.ts:

1. createDonationSchema:
   - campaignId: string, cuid format
   - amount: number, positive, min 10.000 (min donasi), max 100.000.000
   - isAnonymous: boolean, default false
   - message: string, max 300, optional

2. midtransWebhookSchema:
   - order_id: string
   - transaction_status: string
   - fraud_status: string, optional
   - payment_type: string
   - gross_amount: string
   - signature_key: string
   (field lain optional — Midtrans kirim banyak field)
```

---

### [4.2] Donation service 🔴

```
Baca CLAUDE.md section 11 bagian Donation Flow (penting: baca sampai habis termasuk Idempotency).

Buatkan src/services/donation.service.ts:

1. createDonation(userId: string, data: CreateDonationInput): Promise<{ donation, snapToken }>
   - Cek campaign exist dan status ACTIVE
   - Cek deadline campaign belum lewat
   - Hitung platformFee: amount * PLATFORM_FEE_PERCENT / 100
   - Generate midtransOrderId: format 'DON-{campaignId slice 8}-{timestamp}'
   - Create Donation di DB status PENDING, simpan midtransOrderId
   - Buat Snap transaction ke Midtrans:
     - transaction_details: { order_id: midtransOrderId, gross_amount: amount }
     - customer_details dari user
     - item_details: [{ id: campaignId, name: campaign.title, price: amount, quantity: 1 }]
   - Simpan snapToken ke Donation.paymentToken
   - Return { donation, snapToken }

2. handleMidtransWebhook(payload: MidtransWebhookPayload): Promise<void>
   - LANGKAH PERTAMA: Verify signature
     - signature = SHA512(orderId + statusCode + grossAmount + MIDTRANS_SERVER_KEY)
     - Bandingkan dengan payload.signature_key
     - Jika tidak match: throw AppError(403, 'Invalid signature')
   - Cari Donation by midtransOrderId
   - IDEMPOTENCY CHECK: Jika status sudah SUCCESS, langsung return (skip)
   - Jika transaction_status 'settlement' atau 'capture':
     - Dalam satu TRANSACTION:
       - Update Donation: status SUCCESS, paymentMethod, paidAt = now()
       - Increment Campaign.collectedAmount += donation.amount
   - Jika transaction_status 'expire' atau 'cancel' atau 'deny':
     - Update Donation: status FAILED/EXPIRED sesuai

3. getDonationsByUser(userId: string, page?, limit?)
   - Return daftar donasi user, include campaign (title, imageUrl)

4. getDonationsByCampaign(campaignId: string, page?, limit?)
   - Return daftar donasi publik (filter isAnonymous)
   - Jika isAnonymous: return name = 'Donatur Anonim'

PENTING: Signature verification webhook wajib ada sebelum proses apapun.
Konfirmasi implementasi signature verification sebelum lanjut.
```

---

### [4.3] Donation route 🟢

```
Buat src/routes/donation.route.ts:

Protected:
POST /donations → authMiddleware → requirePermission('donation:create') → createDonation
GET /donations/me → authMiddleware → getDonationsByUser

Public:
GET /donations/campaign/:campaignId → getDonationsByCampaign

Webhook (no auth, tapi ada signature verification di service):
POST /webhooks/midtrans → handleMidtransWebhook
  - Jangan pasang authMiddleware di route ini
  - Langsung panggil service, biarkan service yang verify signature

Mount webhook di index.ts dengan path /webhooks/midtrans (terpisah dari /donations).
Konfirmasi struktur mount sebelum implementasi.
```

---

---

## FASE 5 — Withdrawal

---

### [5.1] Withdrawal validator 🟢

```
Buatkan src/validators/withdrawal.validator.ts:

1. createWithdrawalSchema:
   - campaignId: string
   - amount: number, positive, min 100.000
   - bankAccount: string, min 6, max 30 (nomor rekening)
   - bankName: string, min 2, max 50
   - accountHolder: string, min 3, max 100
   - note: string, max 500, optional

2. processWithdrawalSchema (admin):
   - status: z.enum(['APPROVED', 'REJECTED'])
   - note: string, max 500, optional

3. markWithdrawalPaidSchema (admin):
   - proofFile: validasi di service (bukan Zod)
   - Cukup export konstanta: MAX_PROOF_SIZE = 5MB, ALLOWED_PROOF_TYPES
```

---

### [5.2] Withdrawal service 🔴

```
Baca CLAUDE.md section 11 bagian Withdrawal Flow.

Buatkan src/services/withdrawal.service.ts:

1. requestWithdrawal(userId: string, data: CreateWithdrawalInput)
   - Cek campaign exist dan milik userId
   - Cek campaign status ACTIVE atau CLOSED (bukan DRAFT/PENDING_REVIEW)
   - Hitung available balance:
     totalWithdrawn = sum withdrawal dengan status APPROVED atau PAID untuk campaign ini
     available = campaign.collectedAmount - totalWithdrawn
   - Cek data.amount <= available → jika tidak, throw AppError(422, 'Saldo tidak mencukupi. Saldo tersedia: {available}')
   - Hitung adminFee dari constants WITHDRAWAL_ADMIN_FEE
   - Create Withdrawal status PENDING
   - Return withdrawal

2. getWithdrawalsByCampaign(campaignId: string, userId: string)
   - Verifikasi campaign milik userId
   - Return semua withdrawal untuk campaign tersebut

3. getWithdrawalsByUser(userId: string)
   - Return semua withdrawal milik user, include campaign (title)

4. approveWithdrawal(withdrawalId: string, note?: string)  [admin]
   - Cek status PENDING
   - Update status → APPROVED
   - Note opsional dari admin

5. rejectWithdrawal(withdrawalId: string, note: string)  [admin]
   - Cek status PENDING
   - Update status → REJECTED dengan note

6. markWithdrawalPaid(withdrawalId: string, proofFile: File)  [admin]
   - Cek status APPROVED
   - Upload proof ke bucket 'withdrawal-proof'
   - Update status → PAID, set proofUrl
   - Return withdrawal

7. getAllWithdrawals(filter: { status?, page?, limit? })  [admin]
   - Return paginated list, include campaign dan user info

Konfirmasi formula available balance sebelum implementasi.
```

---

### [5.3] Withdrawal route 🟢

```
Buat src/routes/withdrawal.route.ts (user routes):

Protected (authMiddleware):
POST /withdrawals → requirePermission('withdrawal:request') → requestWithdrawal
GET /withdrawals/me → getWithdrawalsByUser
GET /withdrawals/campaign/:campaignId → getWithdrawalsByCampaign

Buat src/routes/admin/withdrawal.route.ts (admin routes):
Semua: authMiddleware + requirePermission('admin:access')

GET /admin/withdrawals → getAllWithdrawals (query: status filter)
POST /admin/withdrawals/:id/approve → requirePermission('withdrawal:approve') → approveWithdrawal
POST /admin/withdrawals/:id/reject → requirePermission('withdrawal:reject') → rejectWithdrawal, body: processWithdrawalSchema
POST /admin/withdrawals/:id/mark-paid → requirePermission('withdrawal:mark-paid') → markWithdrawalPaid (multipart: proofFile)

Mount di admin index.
```

---

---

## FASE 6 — Admin Panel

---

### [6.1] Admin verification route 🟢

```
Lihat file src/routes/admin/verification.route.ts yang sudah ada.
Tampilkan isinya dulu ke saya.

Setelah review, lengkapi atau update dengan:

Semua route: authMiddleware + requirePermission('admin:access')

GET /admin/verifications → list user dengan verificationStatus PENDING
GET /admin/verifications/:userId → detail user (include ktpUrl sebagai signed URL — gunakan getSignedUrl dari storageService)
POST /admin/verifications/:userId/approve → requirePermission('user:verify') → approveVerification
POST /admin/verifications/:userId/reject → requirePermission('user:reject-verification') → rejectVerification, body: { reason: string }

Tambahkan di user.service.ts:
- approveVerification(userId: string): update verificationStatus APPROVED
- rejectVerification(userId: string, reason: string): update verificationStatus REJECTED, set verificationRejectReason
```

---

### [6.2] Admin dashboard stats 🟢

```
Buatkan src/services/admin.service.ts dengan fungsi getDashboardStats():

Return object berisi:
- totalUsers: count semua user
- pendingVerifications: count user verificationStatus PENDING
- totalCampaigns: count semua campaign
- activeCampaigns: count campaign status ACTIVE
- pendingCampaigns: count campaign status PENDING_REVIEW
- totalDonations: count donation status SUCCESS
- totalDonationAmount: sum amount donation SUCCESS
- pendingWithdrawals: count withdrawal status PENDING
- totalWithdrawalAmount: sum amount withdrawal status PAID

Gunakan Prisma aggregation ($count, aggregate._sum) bukan manual loop.
Semua query dalam satu function, jalankan paralel pakai Promise.all().

Buatkan route GET /admin/dashboard di src/routes/admin/index.ts.
```

---

### [6.3] Report & moderation 🟢

```
Buat fungsionalitas report campaign oleh user.

Tambahkan di src/validators/campaign.validator.ts:
- createReportSchema: { reason: string, min 20, max 500 }

Tambahkan di src/services/campaign.service.ts:
- reportCampaign(userId: string, campaignId: string, reason: string)
  - Cek campaign exist
  - Cek user belum pernah report campaign yang sama (unique constraint sudah ada di schema)
  - Create Report

Tambahkan di src/services/admin.service.ts:
- getReports(page?, limit?): list semua report, include user dan campaign
- actionReport(reportId: string, action: 'DISMISS' | 'CLOSE_CAMPAIGN'): 
  - DISMISS: tidak ada action ke campaign
  - CLOSE_CAMPAIGN: panggil closeCampaign()

Route user: POST /campaigns/:id/report → authMiddleware → reportCampaign
Route admin: GET /admin/reports, POST /admin/reports/:id/action
```

---

---

## FASE 7 — Schema Improvements

> Fase ini dikerjakan setelah semua fitur core selesai dan jalan.
> Setiap sub-task menghasilkan satu migration terpisah.

---

### [7.1] Tambah updatedAt ke semua model 🔴

```
Baca CLAUDE.md section 6 bagian Schema Improvement Plan poin 1.

Tampilkan prisma/schema.prisma sekarang.
Setelah review, propose perubahan: tambahkan field updatedAt @updatedAt ke model:
- User, Campaign, Donation, Withdrawal, CampaignUpdate

Jangan langsung edit. Tampilkan diff yang akan dibuat, minta konfirmasi, baru edit.
Setelah edit, berikan command: npx prisma migrate dev --name add_updatedat_to_main_models
```

---

### [7.2] Tambah database index 🔴

```
Baca CLAUDE.md section 6 bagian Schema Improvement Plan poin 2.

Propose penambahan index berikut ke schema.prisma:
- Campaign: @@index([status]), @@index([category]), @@index([userId])
- Donation: @@index([campaignId, status]), @@index([userId])
- Withdrawal: @@index([campaignId]), @@index([status])

Tampilkan diff, minta konfirmasi, baru edit.
Command: npx prisma migrate dev --name add_performance_indexes
```

---

### [7.3] Recovery utility: recalculateCollectedAmount 🟢

```
Baca CLAUDE.md section 6 poin 5 tentang Campaign.collectedAmount consistency.

Tambahkan di src/services/campaign.service.ts:
- recalculateCollectedAmount(campaignId: string): Promise<number>
  - Query SUM amount dari Donation WHERE campaignId = X AND status = SUCCESS
  - Update Campaign.collectedAmount dengan nilai tersebut
  - Return nilai yang diupdate
  - Gunakan $transaction

Ini fungsi utility untuk recovery jika terjadi inconsistency.
Tambahkan route admin: POST /admin/campaigns/:id/recalculate-amount
Hanya admin dengan permission campaign:approve yang bisa akses.
```

---

---

## FASE 8 — Finalisasi & Hardening

---

### [8.1] Environment & config audit 🟡

```
Lakukan audit environment variables.

1. Scan semua file di src/ untuk penggunaan process.env
2. Bandingkan dengan .env.example (jika ada) — buat jika belum ada
3. List semua env variable yang dipakai beserta: nama, tipe, default value (jika ada), wajib/opsional
4. Update .env.example dengan semua variable tersebut (gunakan placeholder, bukan value asli)
5. Tambahkan validasi env di src/lib/env.ts:
   - Gunakan Zod untuk parse dan validate process.env saat startup
   - Throw error jika ada required env yang missing
   - Export typed env object

Tampilkan list env yang ditemukan sebelum implementasi.
```

---

### [8.2] Security hardening 🔴

```
Baca CLAUDE.md section 12 (Security Checklist).

Lakukan review dan hardening:

1. Pastikan semua endpoint yang return data user tidak include: password, nik, ktpUrl (raw path)
   - Scan semua service yang return user object
   - Perbaiki yang masih return field sensitif

2. File upload validation — pastikan semua upload validate:
   - MIME type (jangan trust Content-Type header saja, cek magic bytes jika memungkinkan)
   - Max file size
   - Tambahkan fungsi validateFile(file: File, allowedTypes: string[], maxSize: number) di src/utils/file.ts

3. Rate limiting basic — tambahkan middleware simple di endpoint:
   - POST /auth/login: max 10 request per menit per IP
   - POST /auth/register: max 5 request per menit per IP
   - POST /donations: max 20 request per menit per userId
   Gunakan in-memory store sederhana (Map) — cukup untuk project ini

4. Review semua Prisma query — pastikan tidak ada $queryRawUnsafe

Lakukan satu per satu, konfirmasi setiap poin sebelum eksekusi.
```

---

### [8.3] API documentation sederhana 🟢

```
Buatkan file API_DOCS.md di root project.

Format per endpoint:
## POST /auth/register
**Auth:** Tidak diperlukan
**Body:**
  - name: string (required)
  - email: string (required)
  - password: string (required, min 8 karakter)
**Response 201:** { success, message, data: { user, token } }
**Response 400:** Validation error
**Response 409:** Email sudah terdaftar

Dokumentasikan SEMUA endpoint yang sudah dibuat:
- Auth (register, login, me)
- User (profile, avatar, verification)
- Campaign (CRUD, submit, save, report, documents, updates)
- Donation (create, list, webhook)
- Withdrawal (request, list)
- Admin (verifikasi, campaign review, withdrawal, dashboard, reports)

Susun per grup, tambahkan tabel ringkasan di awal.
```

---

### [8.4] Final check 🔴

```
Lakukan final review menyeluruh.

Checklist:
1. Semua route sudah ter-mount di src/index.ts?
2. Semua service punya error handling yang proper (tidak ada unhandled promise)?
3. Semua file upload ada validasi MIME + size?
4. Midtrans webhook ada signature verification?
5. collectedAmount update selalu dalam transaction?
6. Tidak ada password/nik/ktpUrl yang ter-return di response publik?
7. .env.example sudah up to date?
8. Semua konstanta finansial (fee, limit) ada di constants.ts atau env — tidak hardcoded?

Tampilkan hasilnya sebagai checklist dengan status ✅/❌ per poin.
Untuk yang ❌, jelaskan file dan baris mana yang perlu difix.
```

---

---

## Appendix — Prompt Utilitas

> Prompt-prompt ini bisa dipakai kapan saja, tidak terikat urutan fase.

---

### [U.1] Debug: cek kenapa route tidak ketrigger

```
Route [METHOD] [PATH] tidak berjalan seperti yang diharapkan.
Behavior yang terjadi: [jelaskan]
Behavior yang diharapkan: [jelaskan]

Tolong:
1. Tampilkan file route yang relevan
2. Tampilkan cara mount di index.ts
3. Identifikasi kemungkinan masalah (middleware order, path conflict, dll)
4. Jangan langsung fix — jelaskan dulu temuannya, baru eksekusi setelah konfirmasi
```

---

### [U.2] Tambah field baru ke schema

```
Saya ingin menambahkan field [nama field] bertipe [tipe] ke model [NamaModel].
Field ini [wajib/opsional] dan [punya default value / tidak].
Kegunaan: [jelaskan singkat]

Tolong:
1. Propose perubahan schema.prisma
2. Cek apakah ada service/query yang perlu diupdate
3. Tampilkan diff, minta konfirmasi
4. Setelah konfirmasi, edit schema dan berikan migration command
```

---

### [U.3] Tambah permission baru

```
Saya ingin menambahkan permission baru: [resource:action]
Permission ini akan diassign ke role: [USER / ADMIN / keduanya]
Digunakan di endpoint: [METHOD PATH]

Tolong:
1. Tambahkan ke seed.ts (gunakan upsert)
2. Tambahkan requirePermission() ke route yang relevan
3. Ingatkan saya untuk re-run seed: npx prisma db seed
```

---

### [U.4] Review kode sebelum commit

```
Tolong review file-file berikut sebelum saya commit:
[list file]

Fokus review pada:
1. Apakah ada field sensitif yang ter-return? (password, nik, ktpUrl)
2. Apakah ada business logic yang harusnya di service tapi masih di route?
3. Apakah ada operasi finansial yang tidak dalam transaction?
4. Apakah ada hardcoded value yang harusnya di constants/env?
5. Apakah naming convention sudah sesuai CLAUDE.md?

Tampilkan temuan, jangan langsung fix.
```

---

### [U.5] Handle kasus edge yang belum ter-cover

```
Ada edge case yang belum di-handle:
[deskripsikan skenario]

Contoh: "Bagaimana jika user donasi ke campaign yang deadline-nya baru saja lewat (race condition)?"

Tolong:
1. Identifikasi di service mana ini harus di-handle
2. Propose solusi
3. Konfirmasi sebelum implementasi
```

---

_Prompt playbook ini dibuat berdasarkan CLAUDE.md Donasuke. Update dokumen ini jika ada perubahan arsitektur atau konvensi baru._
