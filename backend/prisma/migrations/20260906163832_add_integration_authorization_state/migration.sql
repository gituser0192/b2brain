-- CreateTable
CREATE TABLE "IntegrationAuthorizationState" (
    "id" UUID NOT NULL,
    "stateHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "returnPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationAuthorizationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAuthorizationState_stateHash_key" ON "IntegrationAuthorizationState"("stateHash");

-- CreateIndex
CREATE INDEX "IntegrationAuthorizationState_expiresAt_idx" ON "IntegrationAuthorizationState"("expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationAuthorizationState_connectorId_idx" ON "IntegrationAuthorizationState"("connectorId");

-- CreateIndex
CREATE INDEX "IntegrationAuthorizationState_organizationId_idx" ON "IntegrationAuthorizationState"("organizationId");

-- CreateIndex
CREATE INDEX "IntegrationAuthorizationState_membershipId_idx" ON "IntegrationAuthorizationState"("membershipId");

-- AddForeignKey
ALTER TABLE "IntegrationAuthorizationState" ADD CONSTRAINT "IntegrationAuthorizationState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAuthorizationState" ADD CONSTRAINT "IntegrationAuthorizationState_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAuthorizationState" ADD CONSTRAINT "IntegrationAuthorizationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAuthorizationState" ADD CONSTRAINT "IntegrationAuthorizationState_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "IntegrationConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
