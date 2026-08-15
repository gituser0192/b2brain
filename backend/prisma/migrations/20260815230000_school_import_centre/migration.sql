-- CreateEnum
CREATE TYPE "SchoolImportStatus" AS ENUM ('PREVIEWED', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SchoolImportBatch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "SchoolImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "payload" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolImportBatch_organizationId_status_expiresAt_idx" ON "SchoolImportBatch"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SchoolImportBatch_createdById_createdAt_idx" ON "SchoolImportBatch"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "SchoolImportBatch" ADD CONSTRAINT "SchoolImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolImportBatch" ADD CONSTRAINT "SchoolImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
