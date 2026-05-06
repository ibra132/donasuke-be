import { Hono } from "hono";
import prisma from "../../lib/prisma";
import {
  getVerificationsQuerySchema,
  rejectVerificationSchema,
} from "../../validators/user.validator";

export const verificationRoute = new Hono();

// -------------------------------------------------------
// GET /api/admin/verifications
// All verifications for admin review
// -------------------------------------------------------
verificationRoute.get("/", async (c) => {
  const query = c.req.query();

  //   Validate query parameters
  const result = getVerificationsQuerySchema.safeParse(query);
  if (!result.success) {
    return c.json(
      {
        message: "Validasi gagal",
        errors: result.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { status } = result.data;

  const verifications = await prisma.user.findMany({
    where: { verificationStatus: status },
    select: {
      id: true,
      name: true,
      email: true,
      nik: true,
      ktpUrl: true,
      verificationStatus: true,
      verificationRejectReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return c.json({ verifications });
});

// -------------------------------------------------------
// PATCH /api/admin/verifications/:id/approve
// Approve a verification request
// -------------------------------------------------------
verificationRoute.patch("/:id/approve", async (c) => {
  const userId = c.req.param("id");

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return c.json({ message: "User tidak ditemukan" }, 404);
  }

  if (user.verificationStatus !== "PENDING") {
    return c.json({ message: "Pengajuan ini sudah diproses sebelumnya" }, 400);
  }

  const fundraiserRole = await prisma.role.findUnique({
    where: { name: "FUNDRAISER" },
  });

  if (!fundraiserRole) {
    return c.json({ message: "Role FUNDRAISER tidak ditemukan" }, 500);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: "APPROVED",
        verificationRejectReason: null,
      },
    }),
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: fundraiserRole.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: fundraiserRole.id,
      },
    }),
  ]);

  return c.json({
    message:
      "Pengajuan verifikasi berhasil disetujui, pengguna sekarang adalah fundraiser",
  });
});

// -------------------------------------------------------
// PATCH /api/admin/verifications/:id/reject
// -------------------------------------------------------
verificationRoute.patch("/:id/reject", async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json();

  //   Validate input
  const result = rejectVerificationSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        message: "Validasi gagal",
        errors: result.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { reason } = result.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return c.json({ message: "User tidak ditemukan" }, 404);
  }

  if (user.verificationStatus !== "PENDING") {
    return c.json({ message: "Pengajuan ini sudah diproses sebelumnya" }, 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      verificationStatus: "REJECTED",
      verificationRejectReason: reason,
    },
  });

  return c.json({ message: "Pengajuan berhasil direject" });
});
