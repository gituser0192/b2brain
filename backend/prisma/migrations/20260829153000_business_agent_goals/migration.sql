CREATE TYPE "BusinessGoalType" AS ENUM ('MONTHLY_REVENUE', 'NEW_LEADS', 'CUSTOMER_CONVERSION', 'EXPENSE_LIMIT', 'PROJECT_COMPLETION', 'FOLLOW_UP_RESPONSE');
CREATE TYPE "BusinessGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED');

CREATE TABLE "BusinessGoal" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "type" "BusinessGoalType" NOT NULL,
  "title" TEXT NOT NULL,
  "targetValue" DECIMAL(18,2) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "BusinessGoalStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "BusinessGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessGoal_organizationId_status_periodEnd_idx" ON "BusinessGoal"("organizationId", "status", "periodEnd");
CREATE INDEX "BusinessGoal_organizationId_type_status_idx" ON "BusinessGoal"("organizationId", "type", "status");
CREATE INDEX "BusinessGoal_createdById_idx" ON "BusinessGoal"("createdById");
CREATE INDEX "BusinessGoal_updatedById_idx" ON "BusinessGoal"("updatedById");
ALTER TABLE "BusinessGoal" ADD CONSTRAINT "BusinessGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessGoal" ADD CONSTRAINT "BusinessGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessGoal" ADD CONSTRAINT "BusinessGoal_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
