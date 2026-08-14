CREATE TYPE "ProviderRequestCategory" AS ENUM ('PLAN_BILLING', 'WEBSITE', 'CRM', 'MARKETING', 'AUTOMATION', 'FINANCE', 'PROJECTS', 'TECHNICAL_SUPPORT', 'OTHER');
CREATE TYPE "ProviderMessageType" AS ENUM ('CUSTOMER_MESSAGE', 'PROVIDER_REPLY', 'INTERNAL_NOTE', 'SYSTEM_EVENT');

CREATE TABLE "ProviderServiceRequest" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "category" "ProviderRequestCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "ManagedServiceStatus" NOT NULL DEFAULT 'SUBMITTED',
  "assignedToId" UUID,
  "customerUpdate" TEXT,
  "internalNote" TEXT,
  "firstRespondedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ProviderServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderServiceMessage" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "type" "ProviderMessageType" NOT NULL,
  "body" TEXT NOT NULL,
  "customerVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ProviderServiceMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderServiceRequest_organizationId_requestNumber_key" ON "ProviderServiceRequest"("organizationId", "requestNumber");
CREATE INDEX "ProviderServiceRequest_organizationId_status_deletedAt_idx" ON "ProviderServiceRequest"("organizationId", "status", "deletedAt");
CREATE INDEX "ProviderServiceRequest_status_priority_updatedAt_idx" ON "ProviderServiceRequest"("status", "priority", "updatedAt");
CREATE INDEX "ProviderServiceMessage_organizationId_requestId_createdAt_idx" ON "ProviderServiceMessage"("organizationId", "requestId", "createdAt");

ALTER TABLE "ProviderServiceRequest" ADD CONSTRAINT "ProviderServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderServiceRequest" ADD CONSTRAINT "ProviderServiceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderServiceRequest" ADD CONSTRAINT "ProviderServiceRequest_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderServiceMessage" ADD CONSTRAINT "ProviderServiceMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderServiceMessage" ADD CONSTRAINT "ProviderServiceMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProviderServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderServiceMessage" ADD CONSTRAINT "ProviderServiceMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
