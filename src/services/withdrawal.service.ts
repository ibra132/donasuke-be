import prisma from "../lib/prisma";
import { uploadFile, BUCKETS } from "./storage.service";
import { AppError } from "../utils/error";
import { WITHDRAWAL_ADMIN_FEE } from "../utils/constants";

type CreateWithdrawalInput = {
  campaignId: string;
  amount: number;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  note?: string;
};

const WITHDRAWABLE_STATUSES = ["ACTIVE", "CLOSED", "EXPIRED"] as const;

const withdrawalBaseSelect = {
  id: true,
  campaignId: true,
  amount: true,
  adminFee: true,
  status: true,
  bankName: true,
  bankAccount: true,
  accountHolder: true,
  note: true,
  createdAt: true,
};

// ── User-facing ───────────────────────────────────────────────
export async function createWithdrawal(
  userId: string,
  data: CreateWithdrawalInput
) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: data.campaignId,
      userId,
      user: {
        verificationStatus: "APPROVED",
      },
    },
    select: {
      status: true,
      collectedAmount: true,
      userId: true,
      user: { select: { verificationStatus: true } },
    },
  });

  if (!campaign) {
    throw new AppError(403, "Campaign tidak ditemukan atau akses ditolak");
  }

  if (!WITHDRAWABLE_STATUSES.includes(campaign.status as any)) {
    throw new AppError(
      422,
      "Campaign harus berstatus ACTIVE, CLOSED, atau EXPIRED untuk melakukan penarikan"
    );
  }

  const usedAgg = await prisma.withdrawal.aggregate({
    where: {
      campaignId: data.campaignId,
      status: { in: ["PENDING", "APPROVED", "PAID"] },
    },
    _sum: { amount: true },
  });

  const available = campaign.collectedAmount - (usedAgg._sum.amount ?? 0);

  if (data.amount > available) {
    throw new AppError(
      422,
      `Saldo tidak cukup. Tersedia: Rp ${available.toLocaleString("id-ID")}`
    );
  }

  return prisma.withdrawal.create({
    data: {
      userId,
      campaignId: data.campaignId,
      amount: data.amount,
      adminFee: WITHDRAWAL_ADMIN_FEE,
      bankName: data.bankName,
      bankAccount: data.bankAccount,
      accountHolder: data.accountHolder,
      note: data.note,
      status: "PENDING",
    },
    select: {
      ...withdrawalBaseSelect,
      campaign: { select: { id: true, title: true } },
    },
  });
}

export async function getMyWithdrawals(userId: string, page = 1, limit = 12) {
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    prisma.withdrawal.findMany({
      where: { userId },
      select: {
        ...withdrawalBaseSelect,
        campaign: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.withdrawal.count({ where: { userId } }),
  ]);

  return { data, total, page, limit };
}

export async function getWithdrawalById(id: string, userId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id },
    select: {
      ...withdrawalBaseSelect,
      userId: true,
      campaign: { select: { id: true, title: true } },
    },
  });
  if (!withdrawal) throw new AppError(404, "Penarikan tidak ditemukan");

  if (withdrawal.userId !== userId)
    throw new AppError(403, "Bukan penarikan milik Anda");

  const { userId: _uid, ...safe } = withdrawal;

  return safe;
}

// ── Admin ─────────────────────────────────────────────────────

const withdrawalAdminSelect = {
  ...withdrawalBaseSelect,
  proofUrl: true,
  campaign: { select: { id: true, title: true } },
  user: { select: { id: true, name: true, email: true } },
};

export async function getAllWithdrawals(page = 1, limit = 12, status?: string) {
  const skip = (page - 1) * limit;
  const where = status ? { status: status as any } : {};

  const [data, total] = await prisma.$transaction([
    prisma.withdrawal.findMany({
      where,
      select: withdrawalAdminSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.withdrawal.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getWithdrawalByIdAdmin(id: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id },
    select: withdrawalAdminSelect,
  });
  if (!withdrawal) throw new AppError(404, "Penarikan tidak ditemukan");

  return withdrawal;
}

export async function approveWithdrawal(withdrawalId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!withdrawal) throw new AppError(404, "Penarikan tidak ditemukan");

  if (withdrawal.status !== "PENDING")
    throw new AppError(
      422,
      "Hanya penarikan berstatus PENDING yang bisa di-approve"
    );

  return prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: "APPROVED" },
    select: withdrawalAdminSelect,
  });
}

export async function rejectWithdrawal(withdrawalId: string, note: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!withdrawal) throw new AppError(404, "Penarikan tidak ditemukan");

  if (withdrawal.status !== "PENDING")
    throw new AppError(
      422,
      "Hanya penarikan berstatus PENDING yang bisa di-reject"
    );

  return prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: "REJECTED", note },
    select: withdrawalAdminSelect,
  });
}

export async function markWithdrawalPaid(
  withdrawalId: string,
  proofFile: File
) {
  const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
  const MAX_SIZE = 10 * 1024 * 1024;

  if (!ALLOWED.includes(proofFile.type))
    throw new AppError(
      400,
      "Format bukti transfer tidak valid. Gunakan JPG, PNG, atau PDF"
    );

  if (proofFile.size > MAX_SIZE)
    throw new AppError(400, "Ukuran file maksimal 10MB");

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });

  if (!withdrawal) throw new AppError(404, "Penarikan tidak ditemukan");

  if (withdrawal.status !== "APPROVED")
    throw new AppError(
      422,
      "Hanya penarikan berstatus APPROVED yang bisa di-mark PAID"
    );

  const ext = proofFile.name.split(".").pop() ?? "bin";
  const path = `${withdrawalId}/${Date.now()}.${ext}`;
  const proofUrl = await uploadFile(
    BUCKETS.WITHDRAWAL_PROOF,
    path,
    await proofFile.arrayBuffer(),
    proofFile.type
  );

  return prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: "PAID", proofUrl },
    select: withdrawalAdminSelect,
  });
}
