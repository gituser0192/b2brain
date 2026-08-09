-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'FULFILLED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "fulfilmentStatus" "FulfilmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "shippingAddress" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "catalogueItemId" UUID,
    "skuSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTax" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_organizationId_status_deletedAt_createdAt_idx" ON "Order"("organizationId", "status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Order_organizationId_customerId_deletedAt_idx" ON "Order"("organizationId", "customerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_orderNumber_key" ON "Order"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_organizationId_orderId_idx" ON "OrderItem"("organizationId", "orderId");

-- CreateIndex
CREATE INDEX "OrderItem_organizationId_catalogueItemId_idx" ON "OrderItem"("organizationId", "catalogueItemId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
