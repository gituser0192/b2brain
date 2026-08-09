CREATE TYPE "BusinessRecommendationStatus" AS ENUM ('OPEN', 'EXECUTED', 'DISMISSED', 'RESOLVED');

CREATE TABLE "BusinessRecommendation" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "actionCode" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "impactSummary" TEXT,
  "priority" "ApprovalRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "status" "BusinessRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "evidence" JSONB NOT NULL,
  "decidedById" UUID,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessRecommendation_organizationId_fingerprint_key" ON "BusinessRecommendation"("organizationId", "fingerprint");
CREATE INDEX "BusinessRecommendation_organizationId_status_priority_createdAt_idx" ON "BusinessRecommendation"("organizationId", "status", "priority", "createdAt");
CREATE INDEX "BusinessRecommendation_organizationId_serviceCode_status_idx" ON "BusinessRecommendation"("organizationId", "serviceCode", "status");
CREATE INDEX "BusinessRecommendation_decidedById_idx" ON "BusinessRecommendation"("decidedById");
ALTER TABLE "BusinessRecommendation" ADD CONSTRAINT "BusinessRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessRecommendation" ADD CONSTRAINT "BusinessRecommendation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
