-- CreateEnum
CREATE TYPE "StayPropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StayBedStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StayResidentStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'NOTICE_PERIOD', 'CHECKED_OUT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "StayOccupancyStatus" AS ENUM ('RESERVED', 'ACTIVE', 'NOTICE_PERIOD', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RentChargeStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "StayPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'CHEQUE', 'PAYMENT_GATEWAY', 'OTHER');

-- CreateTable
CREATE TABLE "StayProperty" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "status" "StayPropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultDueDay" INTEGER NOT NULL DEFAULT 5,
    "currency" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StayProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayRoom" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "roomType" TEXT NOT NULL,
    "monthlyRent" DECIMAL(18,2) NOT NULL,
    "securityDeposit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StayRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayBed" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" "StayBedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "monthlyRent" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StayBed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayResident" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "residentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "status" "StayResidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "whatsappOptInAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StayResident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayOccupancy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "residentId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "status" "StayOccupancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "noticeDate" TIMESTAMP(3),
    "monthlyRent" DECIMAL(18,2) NOT NULL,
    "securityDeposit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depositReceived" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dueDay" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayRentCharge" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "residentId" UUID NOT NULL,
    "occupancyId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(18,2) NOT NULL,
    "utilityAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lateFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "RentChargeStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayRentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayRentPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "StayPaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StayRentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StayProperty_organizationId_status_deletedAt_idx" ON "StayProperty"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StayProperty_organizationId_code_key" ON "StayProperty"("organizationId", "code");

-- CreateIndex
CREATE INDEX "StayRoom_organizationId_propertyId_deletedAt_idx" ON "StayRoom"("organizationId", "propertyId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StayRoom_propertyId_number_key" ON "StayRoom"("propertyId", "number");

-- CreateIndex
CREATE INDEX "StayBed_organizationId_status_deletedAt_idx" ON "StayBed"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StayBed_roomId_label_key" ON "StayBed"("roomId", "label");

-- CreateIndex
CREATE INDEX "StayResident_organizationId_propertyId_status_deletedAt_idx" ON "StayResident"("organizationId", "propertyId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "StayResident_organizationId_phone_deletedAt_idx" ON "StayResident"("organizationId", "phone", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StayResident_organizationId_residentNumber_key" ON "StayResident"("organizationId", "residentNumber");

-- CreateIndex
CREATE INDEX "StayOccupancy_organizationId_propertyId_status_idx" ON "StayOccupancy"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "StayOccupancy_organizationId_residentId_status_idx" ON "StayOccupancy"("organizationId", "residentId", "status");

-- CreateIndex
CREATE INDEX "StayOccupancy_organizationId_bedId_status_idx" ON "StayOccupancy"("organizationId", "bedId", "status");

-- CreateIndex
CREATE INDEX "StayRentCharge_organizationId_propertyId_status_dueDate_idx" ON "StayRentCharge"("organizationId", "propertyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "StayRentCharge_organizationId_residentId_status_idx" ON "StayRentCharge"("organizationId", "residentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StayRentCharge_occupancyId_period_key" ON "StayRentCharge"("occupancyId", "period");

-- CreateIndex
CREATE INDEX "StayRentPayment_organizationId_chargeId_paidAt_idx" ON "StayRentPayment"("organizationId", "chargeId", "paidAt");

-- CreateIndex
CREATE INDEX "StayRentPayment_organizationId_reference_idx" ON "StayRentPayment"("organizationId", "reference");

-- AddForeignKey
ALTER TABLE "StayProperty" ADD CONSTRAINT "StayProperty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayProperty" ADD CONSTRAINT "StayProperty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayProperty" ADD CONSTRAINT "StayProperty_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRoom" ADD CONSTRAINT "StayRoom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRoom" ADD CONSTRAINT "StayRoom_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "StayProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayBed" ADD CONSTRAINT "StayBed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayBed" ADD CONSTRAINT "StayBed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StayRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayResident" ADD CONSTRAINT "StayResident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayResident" ADD CONSTRAINT "StayResident_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "StayProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayResident" ADD CONSTRAINT "StayResident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayResident" ADD CONSTRAINT "StayResident_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayOccupancy" ADD CONSTRAINT "StayOccupancy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayOccupancy" ADD CONSTRAINT "StayOccupancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "StayProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayOccupancy" ADD CONSTRAINT "StayOccupancy_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "StayResident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayOccupancy" ADD CONSTRAINT "StayOccupancy_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "StayBed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayOccupancy" ADD CONSTRAINT "StayOccupancy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentCharge" ADD CONSTRAINT "StayRentCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentCharge" ADD CONSTRAINT "StayRentCharge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "StayProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentCharge" ADD CONSTRAINT "StayRentCharge_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "StayResident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentCharge" ADD CONSTRAINT "StayRentCharge_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "StayOccupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentCharge" ADD CONSTRAINT "StayRentCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentPayment" ADD CONSTRAINT "StayRentPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentPayment" ADD CONSTRAINT "StayRentPayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "StayRentCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayRentPayment" ADD CONSTRAINT "StayRentPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
