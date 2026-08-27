ALTER TABLE "Organization"
ADD COLUMN "industry" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "businessSize" TEXT,
ADD COLUMN "monthlyRevenueRange" TEXT,
ADD COLUMN "primaryBusinessGoal" TEXT,
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Existing organizations predate the onboarding flow and must not be forced
-- through it. Organizations created after this migration start incomplete.
UPDATE "Organization"
SET "onboardingCompletedAt" = "updatedAt"
WHERE "onboardingCompletedAt" IS NULL;
