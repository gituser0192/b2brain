-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ORDER_FULFILMENT', 'RETURN');

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "onHand" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_organizationId_isActive_deletedAt_idx" ON "Warehouse"("organizationId", "isActive", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_organizationId_code_key" ON "Warehouse"("organizationId", "code");

-- CreateIndex
CREATE INDEX "StockLevel_organizationId_catalogueItemId_idx" ON "StockLevel"("organizationId", "catalogueItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_warehouseId_catalogueItemId_key" ON "StockLevel"("warehouseId", "catalogueItemId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_catalogueItemId_createdAt_idx" ON "StockMovement"("organizationId", "catalogueItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_referenceType_referenceId_idx" ON "StockMovement"("organizationId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockReservation_organizationId_orderId_releasedAt_fulfille_idx" ON "StockReservation"("organizationId", "orderId", "releasedAt", "fulfilledAt");

-- CreateIndex
CREATE INDEX "StockReservation_organizationId_warehouseId_catalogueItemId_idx" ON "StockReservation"("organizationId", "warehouseId", "catalogueItemId");

-- CreateIndex
CREATE INDEX "StockReservation_orderItemId_idx" ON "StockReservation"("orderItemId");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
