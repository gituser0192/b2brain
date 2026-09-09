/*
  Warnings:

  - A unique constraint covering the columns `[whatsappPhoneNumberId]` on the table `IntegrationConnector` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnector_whatsappPhoneNumberId_key" ON "IntegrationConnector"("whatsappPhoneNumberId");
