/*
  Warnings:

  - Added the required column `updatedAt` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CampaignUpdate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Donation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Withdrawal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CampaignUpdate" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Campaign_userId_idx" ON "Campaign"("userId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_category_idx" ON "Campaign"("category");

-- CreateIndex
CREATE INDEX "Donation_userId_idx" ON "Donation"("userId");

-- CreateIndex
CREATE INDEX "Donation_campaignId_status_idx" ON "Donation"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Withdrawal_campaignId_idx" ON "Withdrawal"("campaignId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
