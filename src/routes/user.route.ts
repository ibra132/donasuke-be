import { Hono } from "hono";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { verifySchema } from "../validators/user.validator";

export const userRoute = new Hono();

// -------------------------------------------------------
// POST /api/users/me/verify
// Submit verification to become a fundraiser
// -------------------------------------------------------
userRoute.post("/me/verify", authenticate, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  const result = verifySchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        message: "Validasi gagal",
        errors: result.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { nik, ktpUrl } = result.data;

  // Check verification status
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return c.json({ message: "User tidak ditemukan" }, 404);
  }

  // Check if user is already a fundraiser
  if (user.verificationStatus === "APPROVED") {
    return c.json(
      { message: "Akun anda sudah terverifikasi sebagai fundraiser" },
      400
    );
  }

  // Check if user has already submitted verification
  if (user.verificationStatus === "PENDING") {
    return c.json(
      { message: "Pengajuan anda sedang dalam proses review" },
      400
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      nik,
      ktpUrl,
      verificationStatus: "PENDING",
      verificationRejectReason: null,
    },
  });

  return c.json({ message: "Pengajuan verifikasi berhasil dikirim" });
});
