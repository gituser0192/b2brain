ALTER TABLE "Invoice"
  ALTER COLUMN "customerId" DROP NOT NULL,
  ADD COLUMN "customerName" TEXT;
