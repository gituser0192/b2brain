ALTER TABLE "AutomationMessageDraft"
ADD COLUMN "subject" TEXT,
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" UUID;

CREATE INDEX "AutomationMessageDraft_organizationId_sourceType_sourceId_idx"
ON "AutomationMessageDraft"("organizationId", "sourceType", "sourceId");

CREATE UNIQUE INDEX "AutomationMessageDraft_collection_delivery_once_idx"
ON "AutomationMessageDraft"("organizationId", "sourceType", "sourceId")
WHERE "sourceType" = 'COLLECTION_APPROVAL';
