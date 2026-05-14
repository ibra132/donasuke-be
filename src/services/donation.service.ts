import crypto from "crypto";
import prisma from "../lib/prisma";
import snap from "../lib/midtrans";
import { AppError } from "../utils/error";
import { PLATFORM_FEE_PERCENT } from "../utils/constants";

type CreateDonationInput = {
  campaignId: string;
  amount: number;
  isAnonymous?: boolean;
  message?: string;
};

type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  payment_type: string;
};

const donationSelect = {
  id: true,
  campaignId: true,
  amount: true,
  platformFee: true,
  isAnonymous: true,
  message: true,
  status: true,
  paymentToken: true,
  paymentMethod: true,
  midtransOrderId: true,
  paidAt: true,
  createdAt: true,
};

export async function createDonation(
  userId: string,
  data: CreateDonationInput
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    select: { id: true, status: true, deadline: true, title: true },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.status !== "ACTIVE")
    throw new AppError(422, "Campaign tidak aktif");

  if (campaign.deadline < new Date())
    throw new AppError(422, "Campaign sudah melewati deadline");

  const platformFee = Math.round((data.amount * PLATFORM_FEE_PERCENT) / 100);

  const donation = await prisma.donation.create({
    data: {
      userId,
      campaignId: data.campaignId,
      amount: data.amount,
      platformFee,
      isAnonymous: data.isAnonymous ?? false,
      message: data.message,
      status: "PENDING",
    },
    select: { id: true },
  });

  const orderId = `DON-${donation.id}`;

  let snapToken: string;

  try {
    const result = await snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: data.amount,
      },
      item_details: [
        {
          id: data.campaignId,
          name: campaign.title.slice(0, 50),
          quantity: 1,
          price: data.amount,
        },
      ],
    });
    snapToken = result.token as string;
  } catch (err) {
    console.error("[midtrans] createTransaction error:", err);
    await prisma.donation.delete({ where: { id: donation.id } });
    throw new AppError(500, "Gagal membuat transaksi pembayaran");
  }

  return prisma.donation.update({
    where: { id: donation.id },
    data: { paymentToken: snapToken, midtransOrderId: orderId },
    select: donationSelect,
  });
}

export async function handleMidtransWebhook(payload: MidtransNotification) {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    payment_type,
  } = payload;

  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const expected = crypto
    .createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest("hex");

  if (expected !== signature_key)
    throw new AppError(400, "Signature tidak valid");

  const donation = await prisma.donation.findUnique({
    where: { midtransOrderId: order_id },
  });

  if (!donation) return;

  // Idempotency — sudah diproses sebelumnya, skip
  if (donation.status === "SUCCESS") return;

  if (transaction_status === "settlement" || transaction_status === "capture") {
    await prisma.$transaction(async (tx) => {
      await tx.donation.update({
        where: { id: donation.id },
        data: {
          status: "SUCCESS",
          paidAt: new Date(),
          paymentMethod: payment_type,
        },
      });
      await tx.campaign.update({
        where: { id: donation.campaignId },
        data: { collectedAmount: { increment: donation.amount } },
      });
    });
  } else if (transaction_status === "expire") {
    await prisma.donation.update({
      where: { id: donation.id },
      data: { status: "EXPIRED" },
    });
  } else if (["cancel", "deny", "failure"].includes(transaction_status)) {
    await prisma.donation.update({
      where: { id: donation.id },
      data: { status: "FAILED" },
    });
  }
}

export async function getMyDonations(userId: string, page = 1, limit = 12) {
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    prisma.donation.findMany({
      where: { userId },
      select: {
        ...donationSelect,
        campaign: { select: { id: true, title: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.donation.count({ where: { userId } }),
  ]);

  return { data, total, page, limit };
}

export async function getDonationById(id: string, userId: string) {
  const donation = await prisma.donation.findUnique({
    where: { id },
    select: {
      ...donationSelect,
      userId: true,
      campaign: { select: { id: true, title: true, imageUrl: true } },
    },
  });

  if (!donation) throw new AppError(404, "Donasi tidak ditemukan");

  if (donation.userId !== userId)
    throw new AppError(403, "Bukan donasi milik Anda");

  const { userId: _uid, ...safe } = donation;

  return safe;
}

type GetCampaignDonationsFilter = {
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "largest" | "smallest";
};

export async function getCampaignDonations(
  campaignId: string,
  filter: GetCampaignDonationsFilter = {}
) {
  const { page = 1, limit = 10, sort = "newest" } = filter;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  const skip = (page - 1) * limit;
  const where = { campaignId, status: "SUCCESS" as const };

  const orderBy =
    sort === "oldest" ? { createdAt: "asc" as const } :
    sort === "largest" ? { amount: "desc" as const } :
    sort === "smallest" ? { amount: "asc" as const } :
    { createdAt: "desc" as const };

  const [donations, total] = await prisma.$transaction([
    prisma.donation.findMany({
      where,
      select: {
        id: true,
        amount: true,
        isAnonymous: true,
        message: true,
        paidAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.donation.count({ where }),
  ]);

  const data = donations.map(({ user, ...d }) => ({
    ...d,
    user: d.isAnonymous ? null : user,
  }));

  return { data, total, page, limit };
}
