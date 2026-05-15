import prisma from "../lib/prisma";
import {
  uploadFile,
  deleteFile,
  getSignedUrl,
  BUCKETS,
} from "./storage.service";
import { AppError } from "../utils/error";
import {
  ALLOWED_AVATAR_TYPES,
  MAX_AVATAR_SIZE,
} from "../validators/user.validator";

type UpdateProfileInput = { name?: string; bio?: string };

const ALLOWED_KTP_TYPES = ["image/jpeg", "image/png"] as const;
const MAX_KTP_SIZE = 5 * 1024 * 1024; // 5MB

function mimeToExt(mime: string): string {
  return mime === "image/png" ? "png" : "jpg";
}

// Extract storage path from public URL for deletion
function extractPath(publicUrl: string, bucket: string): string {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  return idx !== -1 ? publicUrl.substring(idx + marker.length) : publicUrl;
}

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  bio: true,
  verificationStatus: true,
  verificationRejectReason: true,
  createdAt: true,
  roles: {
    select: {
      role: { select: { name: true } },
    },
  },
};

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });
  if (!user) throw new AppError(404, "User tidak ditemukan");

  const roles = user.roles.map((ur) => ur.role.name);

  return { ...user, roles };
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: safeUserSelect,
  });
  const roles = user.roles.map((ur) => ur.role.name);

  return { ...user, roles };
}

export async function uploadAvatar(userId: string, file: File) {
  if (
    !ALLOWED_AVATAR_TYPES.includes(
      file.type as (typeof ALLOWED_AVATAR_TYPES)[number]
    )
  ) {
    throw new AppError(400, "Format file tidak valid. Gunakan JPEG atau PNG");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new AppError(400, "Ukuran file maksimal 2MB");
  }

  const ext = mimeToExt(file.type);
  const path = `${userId}/${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  if (existing?.avatar) {
    await deleteFile(
      BUCKETS.AVATAR,
      extractPath(existing.avatar, BUCKETS.AVATAR)
    ).catch(() => null);
  }

  const avatarUrl = await uploadFile(BUCKETS.AVATAR, path, buffer, file.type);

  await prisma.user.update({
    where: { id: userId },
    data: { avatar: avatarUrl },
  });

  return avatarUrl;
}

export async function submitVerification(
  userId: string,
  nik: string,
  ktpFile: File
) {
  if (
    !ALLOWED_KTP_TYPES.includes(
      ktpFile.type as (typeof ALLOWED_KTP_TYPES)[number]
    )
  ) {
    throw new AppError(
      400,
      "Format file KTP tidak valid. Gunakan JPEG atau PNG"
    );
  }

  if (ktpFile.size > MAX_KTP_SIZE) {
    throw new AppError(400, "Ukuran file KTP maksimal 5MB");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true },
  });

  if (!user) throw new AppError(404, "User tidak ditemukan");

  if (user.verificationStatus === "APPROVED") {
    throw new AppError(422, "Akun sudah terverifikasi");
  }

  if (user.verificationStatus === "PENDING") {
    throw new AppError(422, "Verifikasi sedang dalam proses review");
  }

  const ext = mimeToExt(ktpFile.type);
  const path = `${userId}/${Date.now()}.${ext}`;
  const buffer = await ktpFile.arrayBuffer();

  await uploadFile(BUCKETS.KTP, path, buffer, ktpFile.type);

  await prisma.user.update({
    where: { id: userId },
    data: {
      nik,
      ktpUrl: path,
      verificationStatus: "PENDING",
      verificationRejectReason: null,
    },
  });

  return { nik, verificationStatus: "PENDING" as const };
}

const KTP_SIGNED_URL_EXPIRY = 3600;

export async function getVerifications(
  status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING",
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;
  const where = { verificationStatus: status };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        verificationStatus: true,
        verificationRejectReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getVerificationDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  });

  if (!user) throw new AppError(404, "User tidak ditemukan");

  const { ktpUrl, ...rest } = user;
  const ktpSignedUrl = ktpUrl
    ? await getSignedUrl(BUCKETS.KTP, ktpUrl, KTP_SIGNED_URL_EXPIRY)
    : null;

  return { ...rest, ktpUrl: ktpSignedUrl };
}

export async function approveVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true },
  });

  if (!user) throw new AppError(404, "User tidak ditemukan");

  if (user.verificationStatus !== "PENDING")
    throw new AppError(422, "Pengajuan ini sudah diproses sebelumnya");

  const fundraiserRole = await prisma.role.findUnique({
    where: { name: "FUNDRAISER" },
  });

  if (!fundraiserRole)
    throw new AppError(500, "Role FUNDRAISER tidak ditemukan di database");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "APPROVED", verificationRejectReason: null },
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: fundraiserRole.id } },
      update: {},
      create: { userId, roleId: fundraiserRole.id },
    }),
  ]);
}

export async function rejectVerification(userId: string, reason: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true },
  });

  if (!user) throw new AppError(404, "User tidak ditemukan");

  if (user.verificationStatus !== "PENDING")
    throw new AppError(422, "Pengajuan ini sudah diproses sebelumnya");

  await prisma.user.update({
    where: { id: userId },
    data: { verificationStatus: "REJECTED", verificationRejectReason: reason },
  });
}
