-- Link collection follow-ups to their verified invoice instead of relying on display titles.
ALTER TABLE "CustomerFollowUp" ADD COLUMN "invoiceId" UUID;

-- Backfill follow-ups created by both the manual Finance action and the Collection Agent.
UPDATE "CustomerFollowUp" AS follow_up
SET "invoiceId" = invoice."id"
FROM "Invoice" AS invoice
WHERE follow_up."organizationId" = invoice."organizationId"
  AND follow_up."customerId" = invoice."customerId"
  AND follow_up."deletedAt" IS NULL
  AND (
    follow_up."title" = 'Collect ' || invoice."invoiceNumber"
    OR follow_up."title" = 'Payment follow-up: ' || invoice."invoiceNumber"
  );

CREATE INDEX "CustomerFollowUp_organizationId_invoiceId_status_deletedAt_idx"
ON "CustomerFollowUp"("organizationId", "invoiceId", "status", "deletedAt");

ALTER TABLE "CustomerFollowUp"
ADD CONSTRAINT "CustomerFollowUp_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
