-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELED');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "currency" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorProduct" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "vendorSku" TEXT,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "leadTimeDays" INTEGER,
    "minimumQuantity" DECIMAL(18,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "expectedDelivery" TIMESTAMP(3),
    "supplierReference" TEXT,
    "supplierInvoice" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "receivedQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTax" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "supplierDeliveryReference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "goodsReceiptId" UUID NOT NULL,
    "purchaseOrderItemId" UUID NOT NULL,
    "catalogueItemId" UUID NOT NULL,
    "quantityReceived" DECIMAL(18,3) NOT NULL,
    "quantityRejected" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_organizationId_status_deletedAt_idx" ON "Vendor"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_organizationId_code_key" ON "Vendor"("organizationId", "code");

-- CreateIndex
CREATE INDEX "VendorProduct_organizationId_catalogueItemId_idx" ON "VendorProduct"("organizationId", "catalogueItemId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorProduct_vendorId_catalogueItemId_key" ON "VendorProduct"("vendorId", "catalogueItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_status_deletedAt_expectedDeliv_idx" ON "PurchaseOrder"("organizationId", "status", "deletedAt", "expectedDelivery");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_vendorId_deletedAt_idx" ON "PurchaseOrder"("organizationId", "vendorId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_orderNumber_key" ON "PurchaseOrder"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_organizationId_purchaseOrderId_idx" ON "PurchaseOrderItem"("organizationId", "purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_organizationId_catalogueItemId_idx" ON "PurchaseOrderItem"("organizationId", "catalogueItemId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_organizationId_purchaseOrderId_receivedAt_idx" ON "GoodsReceipt"("organizationId", "purchaseOrderId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_organizationId_receiptNumber_key" ON "GoodsReceipt"("organizationId", "receiptNumber");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_organizationId_goodsReceiptId_idx" ON "GoodsReceiptItem"("organizationId", "goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "CatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
