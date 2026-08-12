CREATE TYPE "PaymentAccountType" AS ENUM ('BANK', 'UPI', 'CASH', 'PAYMENT_GATEWAY', 'OTHER');
CREATE TYPE "IncomingPaymentStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'PARTIALLY_MATCHED', 'IGNORED');
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELED');

ALTER TABLE "Payment"
  ADD COLUMN "receiptNumber" TEXT,
  ADD COLUMN "incomingTransactionId" UUID,
  ADD COLUMN "refundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "Payment" SET "receiptNumber" = 'LEGACY-' || "id"::text WHERE "receiptNumber" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "receiptNumber" SET NOT NULL;

CREATE TABLE "PaymentAccount" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PaymentAccountType" NOT NULL,
  "identifier" TEXT NOT NULL,
  "bankName" TEXT,
  "accountLast4" TEXT,
  "instructions" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomingPaymentTransaction" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "paymentAccountId" UUID NOT NULL,
  "externalReference" TEXT NOT NULL,
  "payerName" TEXT,
  "payerContact" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" "IncomingPaymentStatus" NOT NULL DEFAULT 'UNMATCHED',
  "notes" TEXT,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "IncomingPaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRefund" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "requestedById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_incomingTransactionId_key" ON "Payment"("incomingTransactionId");
CREATE UNIQUE INDEX "Payment_organizationId_receiptNumber_key" ON "Payment"("organizationId", "receiptNumber");
CREATE UNIQUE INDEX "PaymentAccount_organizationId_identifier_key" ON "PaymentAccount"("organizationId", "identifier");
CREATE INDEX "PaymentAccount_organizationId_isActive_archivedAt_idx" ON "PaymentAccount"("organizationId", "isActive", "archivedAt");
CREATE UNIQUE INDEX "IncomingPaymentTransaction_organizationId_externalReference_key" ON "IncomingPaymentTransaction"("organizationId", "externalReference");
CREATE INDEX "IncomingPaymentTransaction_organizationId_status_deletedAt_receivedAt_idx" ON "IncomingPaymentTransaction"("organizationId", "status", "deletedAt", "receivedAt");
CREATE INDEX "IncomingPaymentTransaction_organizationId_paymentAccountId_receivedAt_idx" ON "IncomingPaymentTransaction"("organizationId", "paymentAccountId", "receivedAt");
CREATE INDEX "PaymentRefund_organizationId_status_createdAt_idx" ON "PaymentRefund"("organizationId", "status", "createdAt");
CREATE INDEX "PaymentRefund_organizationId_paymentId_status_idx" ON "PaymentRefund"("organizationId", "paymentId", "status");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_incomingTransactionId_fkey" FOREIGN KEY ("incomingTransactionId") REFERENCES "IncomingPaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncomingPaymentTransaction" ADD CONSTRAINT "IncomingPaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomingPaymentTransaction" ADD CONSTRAINT "IncomingPaymentTransaction_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncomingPaymentTransaction" ADD CONSTRAINT "IncomingPaymentTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncomingPaymentTransaction" ADD CONSTRAINT "IncomingPaymentTransaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
