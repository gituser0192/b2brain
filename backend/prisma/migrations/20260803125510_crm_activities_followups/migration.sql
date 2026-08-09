-- CreateEnum
CREATE TYPE "CustomerActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "CustomerActivity" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "CustomerActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFollowUp" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerActivity_organizationId_customerId_deletedAt_occurr_idx" ON "CustomerActivity"("organizationId", "customerId", "deletedAt", "occurredAt");

-- CreateIndex
CREATE INDEX "CustomerActivity_createdById_idx" ON "CustomerActivity"("createdById");

-- CreateIndex
CREATE INDEX "CustomerActivity_updatedById_idx" ON "CustomerActivity"("updatedById");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_organizationId_customerId_status_deletedAt_idx" ON "CustomerFollowUp"("organizationId", "customerId", "status", "deletedAt", "dueAt");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_organizationId_assignedToId_status_dueAt_idx" ON "CustomerFollowUp"("organizationId", "assignedToId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_createdById_idx" ON "CustomerFollowUp"("createdById");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_updatedById_idx" ON "CustomerFollowUp"("updatedById");

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
