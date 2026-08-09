-- CreateEnum
CREATE TYPE "MarketingChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SOCIAL', 'SEARCH', 'DISPLAY', 'WEBSITE', 'EVENT', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CampaignLeadStatus" AS ENUM ('CAPTURED', 'ENGAGED', 'CONVERTED', 'DISQUALIFIED');

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MarketingChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" TEXT,
    "audience" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "budget" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "dealId" UUID,
    "status" "CampaignLeadStatus" NOT NULL DEFAULT 'CAPTURED',
    "sourceDetail" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingCampaign_organizationId_status_deletedAt_startDate_idx" ON "MarketingCampaign"("organizationId", "status", "deletedAt", "startDate");

-- CreateIndex
CREATE INDEX "MarketingCampaign_organizationId_channel_deletedAt_idx" ON "MarketingCampaign"("organizationId", "channel", "deletedAt");

-- CreateIndex
CREATE INDEX "CampaignLead_organizationId_campaignId_status_idx" ON "CampaignLead"("organizationId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignLead_organizationId_customerId_idx" ON "CampaignLead"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "CampaignLead_organizationId_dealId_idx" ON "CampaignLead"("organizationId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLead_campaignId_customerId_key" ON "CampaignLead"("campaignId", "customerId");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
