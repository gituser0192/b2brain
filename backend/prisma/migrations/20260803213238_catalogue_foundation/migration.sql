-- CreateEnum
CREATE TYPE "CatalogueItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "CatalogueItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'HOURLY', 'DAILY', 'MONTHLY', 'SUBSCRIPTION', 'CUSTOM');

-- CreateTable
CREATE TABLE "CatalogueItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "CatalogueItemType" NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "CatalogueItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingType" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
    "sellingPrice" DECIMAL(18,2) NOT NULL,
    "costPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueVariant" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sellingPrice" DECIMAL(18,2),
    "costPrice" DECIMAL(18,2),
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogueVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogueItem_organizationId_type_status_deletedAt_idx" ON "CatalogueItem"("organizationId", "type", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "CatalogueItem_organizationId_category_deletedAt_idx" ON "CatalogueItem"("organizationId", "category", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueItem_organizationId_sku_key" ON "CatalogueItem"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "CatalogueVariant_organizationId_itemId_deletedAt_idx" ON "CatalogueVariant"("organizationId", "itemId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueVariant_itemId_code_key" ON "CatalogueVariant"("itemId", "code");

-- AddForeignKey
ALTER TABLE "CatalogueItem" ADD CONSTRAINT "CatalogueItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueItem" ADD CONSTRAINT "CatalogueItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueItem" ADD CONSTRAINT "CatalogueItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueVariant" ADD CONSTRAINT "CatalogueVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
