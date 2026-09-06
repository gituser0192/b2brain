ALTER TABLE "IntegrationConnector" ADD COLUMN "metaPageId" TEXT;

CREATE UNIQUE INDEX "IntegrationConnector_metaPageId_key" ON "IntegrationConnector"("metaPageId");
