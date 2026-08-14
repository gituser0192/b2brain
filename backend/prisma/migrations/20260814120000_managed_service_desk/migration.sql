CREATE TYPE "ManagedServiceStatus" AS ENUM ('SUBMITTED', 'TRIAGED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'AWAITING_CUSTOMER_APPROVAL', 'COMPLETED', 'CANCELED');

ALTER TABLE "WebsiteChangeRequest"
ADD COLUMN "submittedToProviderAt" TIMESTAMP(3),
ADD COLUMN "providerStatus" "ManagedServiceStatus",
ADD COLUMN "providerAssignedToId" UUID,
ADD COLUMN "providerCustomerUpdate" TEXT,
ADD COLUMN "providerInternalNote" TEXT,
ADD COLUMN "providerUpdatedAt" TIMESTAMP(3),
ADD COLUMN "providerCompletedAt" TIMESTAMP(3);

CREATE INDEX "WebsiteChangeRequest_submittedToProviderAt_providerStatus_providerUpdatedAt_idx"
ON "WebsiteChangeRequest"("submittedToProviderAt", "providerStatus", "providerUpdatedAt");
