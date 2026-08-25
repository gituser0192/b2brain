ALTER TABLE "BusinessRecommendation" ADD COLUMN "snoozedUntil" TIMESTAMP(3);
CREATE INDEX "BusinessRecommendation_organizationId_status_snoozedUntil_idx" ON "BusinessRecommendation"("organizationId", "status", "snoozedUntil");
