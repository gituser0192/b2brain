-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('PROSPECTING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Deal" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'PROSPECTING',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "notes" TEXT,
    "ownerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_organizationId_stage_deletedAt_expectedCloseDate_idx" ON "Deal"("organizationId", "stage", "deletedAt", "expectedCloseDate");

-- CreateIndex
CREATE INDEX "Deal_organizationId_customerId_deletedAt_idx" ON "Deal"("organizationId", "customerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Deal_organizationId_ownerId_stage_idx" ON "Deal"("organizationId", "ownerId", "stage");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
