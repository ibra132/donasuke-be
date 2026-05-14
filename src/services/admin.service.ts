import prisma from "../lib/prisma";
import { AppError } from "../utils/error";
import { closeCampaign } from "./campaign.service";

export async function getDashboardStats() {
  const [
    totalUsers,
    pendingVerifications,
    totalCampaigns,
    activeCampaigns,
    pendingCampaigns,
    donationStats,
    pendingWithdrawals,
    withdrawalPaidStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { verificationStatus: "PENDING" } }),
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.campaign.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.donation.aggregate({
      where: { status: "SUCCESS" },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.withdrawal.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalUsers,
    pendingVerifications,
    totalCampaigns,
    activeCampaigns,
    pendingCampaigns,
    totalDonations: donationStats._count,
    totalDonationAmount: donationStats._sum.amount ?? 0,
    pendingWithdrawals,
    totalWithdrawalAmount: withdrawalPaidStats._sum.amount ?? 0,
  };
}

export async function getReports(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    prisma.report.findMany({
      select: {
        id: true,
        reason: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        campaign: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.report.count(),
  ]);

  return { data, total, page, limit };
}

export async function actionReport(
  reportId: string,
  action: "DISMISS" | "CLOSE_CAMPAIGN"
) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, campaignId: true },
  });

  if (!report) throw new AppError(404, "Laporan tidak ditemukan");

  if (action === "CLOSE_CAMPAIGN") {
    await closeCampaign(report.campaignId);
  }

  return { reportId, action };
}
