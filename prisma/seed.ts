import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================
// PERMISSION DEFINITIONS
// Format: <resource>:<action> atau <resource>:<action>:<scope>
// Scope digunakan untuk membedakan akses own vs all
// ============================================================

const PERMISSIONS = [
  // ----------------------------------------------------------
  // CAMPAIGN
  // ----------------------------------------------------------

  // campaign:view — melihat campaign (public, tapi tetap didefinisikan
  // agar bisa dikontrol jika suatu saat campaign dijadikan private)
  { action: "campaign:view", description: "Lihat campaign" },

  // campaign:create — membuat campaign baru (khusus fundraiser)
  { action: "campaign:create", description: "Buat campaign baru" },

  // campaign:submit — submit campaign DRAFT ke PENDING_REVIEW
  { action: "campaign:submit", description: "Submit campaign untuk review" },

  // campaign:update:own — edit campaign milik sendiri (fundraiser)
  // dipisah dari update:all agar fundraiser tidak bisa edit campaign orang lain
  { action: "campaign:update:own", description: "Edit campaign milik sendiri" },

  // campaign:update:all — edit campaign siapapun (admin)
  { action: "campaign:update:all", description: "Edit semua campaign" },

  // campaign:close — fundraiser menutup campaign miliknya sendiri
  // campaign tetap visible di publik, hanya statusnya berubah ke CLOSED
  // ini berbeda dengan archive yang menyembunyikan campaign dari publik
  { action: "campaign:close", description: "Tutup campaign milik sendiri" },

  // campaign:archive — admin menyembunyikan campaign dari publik
  // lebih powerful dari close, hanya boleh dipegang admin
  { action: "campaign:archive", description: "Arsipkan campaign" },

  // campaign:approve — admin menyetujui campaign yang pending review
  { action: "campaign:approve", description: "Approve campaign" },

  // campaign:reject — admin menolak campaign yang pending review
  { action: "campaign:reject", description: "Reject campaign" },

  // ----------------------------------------------------------
  // SAVED CAMPAIGN
  // Dipisah jadi dua permission agar granular
  // user bisa saja punya akses save tapi tidak unsave, atau sebaliknya
  // ----------------------------------------------------------
  {
    action: "saved-campaign:create",
    description: "Simpan campaign ke favorit",
  },
  {
    action: "saved-campaign:delete",
    description: "Hapus campaign dari favorit",
  },

  // ----------------------------------------------------------
  // DONATION
  // ----------------------------------------------------------
  { action: "donation:create", description: "Donasi ke campaign" },

  // donation:view:own — donatur lihat riwayat donasi miliknya sendiri
  { action: "donation:view:own", description: "Lihat donasi milik sendiri" },

  // donation:view:all — admin lihat semua donasi di platform
  { action: "donation:view:all", description: "Lihat semua donasi" },

  // ----------------------------------------------------------
  // USER
  // ----------------------------------------------------------
  { action: "user:view:own", description: "Lihat profil sendiri" },
  { action: "user:view:all", description: "Lihat semua user" },
  { action: "user:update:own", description: "Edit profil sendiri" },
  { action: "user:update:all", description: "Edit semua profil user" },

  // user:verify — admin memverifikasi pengajuan fundraiser
  { action: "user:verify", description: "Verifikasi pengajuan fundraiser" },

  // ----------------------------------------------------------
  // WITHDRAWAL
  // ----------------------------------------------------------

  // withdrawal:request — fundraiser mengajukan pencairan dana
  { action: "withdrawal:request", description: "Ajukan pencairan dana" },

  // withdrawal:view:own — fundraiser lihat riwayat withdrawal miliknya
  {
    action: "withdrawal:view:own",
    description: "Lihat withdrawal milik sendiri",
  },

  // withdrawal:view:all — admin lihat semua withdrawal
  { action: "withdrawal:view:all", description: "Lihat semua withdrawal" },

  // withdrawal:approve — admin menyetujui withdrawal
  { action: "withdrawal:approve", description: "Approve withdrawal" },

  // withdrawal:reject — admin menolak withdrawal
  // dipisah dari approve karena secara bisnis keduanya bisa punya
  // logic berbeda (misal reject butuh alasan, approve butuh bukti transfer)
  { action: "withdrawal:reject", description: "Reject withdrawal" },

  // ----------------------------------------------------------
  // REPORT
  // ----------------------------------------------------------

  // admin:access — gerbang masuk ke semua admin panel endpoint
  { action: "admin:access", description: "Akses admin panel" },

  // report:create — user melaporkan campaign mencurigakan
  { action: "report:create", description: "Buat laporan campaign" },

  // report:review — admin membuka dan membaca report
  { action: "report:review", description: "Review laporan masuk" },

  // report:resolve — admin menyelesaikan / menutup report
  // dipisah dari review karena review = sedang ditangani, resolve = selesai
  { action: "report:resolve", description: "Selesaikan laporan" },
] as const;

// ============================================================
// ROLE → PERMISSION MAPPING
// Admin didefinisikan eksplisit tanpa inheritance dari role lain
// Alasan: inheritance tersembunyi menyulitkan audit permission
// Dengan eksplisit, mudah untuk tahu persis apa yang bisa dilakukan admin
// ============================================================

const ROLE_PERMISSIONS = {
  DONATUR: [
    "campaign:view",
    "saved-campaign:create",
    "saved-campaign:delete",
    "donation:create",
    "donation:view:own",
    "user:view:own",
    "user:update:own",
    "report:create",
  ],

  FUNDRAISER: [
    // Semua yang bisa dilakukan DONATUR
    "campaign:view",
    "saved-campaign:create",
    "saved-campaign:delete",
    "donation:create",
    "donation:view:own",
    "user:view:own",
    "user:update:own",
    "report:create",
    // Tambahan privilege FUNDRAISER
    "campaign:create",
    "campaign:submit",
    "campaign:update:own",
    "campaign:close",
    "withdrawal:request",
    "withdrawal:view:own",
  ],

  ADMIN: [
    // Admin panel access
    "admin:access",
    // Campaign
    "campaign:view",
    "campaign:update:all",
    "campaign:approve",
    "campaign:reject",
    "campaign:archive",
    "campaign:close",
    // Donation
    "donation:view:all",
    // User
    "user:view:all",
    "user:update:all",
    "user:verify",
    // Withdrawal
    "withdrawal:view:all",
    "withdrawal:approve",
    "withdrawal:reject",
    // Report
    "report:review",
    "report:resolve",
  ],
} as const;

// ============================================================
// SEED FUNCTION
// Menggunakan upsert di setiap operasi agar idempotent
// Idempotent = aman dijalankan berkali-kali tanpa duplikasi data
// ============================================================

async function main() {
  console.log("Starting seed...\n");

  // ----------------------------------------------------------
  // 1. SEED PERMISSIONS
  // ----------------------------------------------------------
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action: permission.action },
      update: { description: permission.description },
      create: permission,
    });
  }
  console.log(`✓ ${PERMISSIONS.length} permissions seeded`);

  // ----------------------------------------------------------
  // 2. SEED ROLES
  // ----------------------------------------------------------
  const roleDefinitions = [
    { name: "DONATUR", description: "User biasa, dapat berdonasi" },
    { name: "FUNDRAISER", description: "Penggalang dana" },
    { name: "ADMIN", description: "Administrator platform" },
  ];

  for (const roleDef of roleDefinitions) {
    await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: roleDef,
    });
  }
  console.log(`✓ ${roleDefinitions.length} roles seeded`);

  // ----------------------------------------------------------
  // 3. ASSIGN PERMISSIONS KE ROLE
  // ----------------------------------------------------------
  for (const [roleName, permissionActions] of Object.entries(
    ROLE_PERMISSIONS
  )) {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) continue;

    for (const action of permissionActions) {
      const permission = await prisma.permission.findUnique({
        where: { action },
      });

      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(
      `✓ ${permissionActions.length} permissions assigned to ${roleName}`
    );
  }

  // ----------------------------------------------------------
  // 4. SEED ADMIN USER
  // ----------------------------------------------------------
  const hashedPassword = await bcrypt.hash("viltrume123", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@donasuke.com" },
    update: {},
    create: {
      name: "Admin Donasuke",
      email: "admin@donasuke.com",
      password: hashedPassword,
    },
  });

  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });
  }

  console.log("\n✓ Admin user seeded");
  console.log("  Email   : admin@donasuke.com");
  console.log("  Password: viltrume123");
  console.log("\nSeed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
