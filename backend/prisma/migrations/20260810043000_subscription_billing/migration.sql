ALTER TYPE "OrganizationPlanStatus" ADD VALUE 'PAST_DUE';

CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PAID', 'REFUNDED', 'VOID');

ALTER TABLE "ServicePlan"
  ADD COLUMN "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "yearlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';

ALTER TABLE "OrganizationPlan"
  ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN "nextBillingAt" TIMESTAMP(3),
  ADD COLUMN "pastDueAt" TIMESTAMP(3);

CREATE TABLE "SubscriptionPayment" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "organizationPlanId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PAID',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "periodStartsAt" TIMESTAMP(3) NOT NULL,
  "periodEndsAt" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionPayment_organizationId_paidAt_idx" ON "SubscriptionPayment"("organizationId", "paidAt");
CREATE INDEX "SubscriptionPayment_organizationPlanId_paidAt_idx" ON "SubscriptionPayment"("organizationPlanId", "paidAt");
CREATE INDEX "SubscriptionPayment_createdById_idx" ON "SubscriptionPayment"("createdById");

ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationPlanId_fkey" FOREIGN KEY ("organizationPlanId") REFERENCES "OrganizationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
