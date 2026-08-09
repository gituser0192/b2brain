-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "CustomerType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'LEAD',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_deletedAt_createdAt_idx" ON "Customer"("organizationId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_organizationId_status_deletedAt_idx" ON "Customer"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Customer_organizationId_displayName_idx" ON "Customer"("organizationId", "displayName");

-- CreateIndex
CREATE INDEX "Customer_createdById_idx" ON "Customer"("createdById");

-- CreateIndex
CREATE INDEX "Customer_updatedById_idx" ON "Customer"("updatedById");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
