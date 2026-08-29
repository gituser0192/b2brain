CREATE TYPE "BusinessKnowledgeStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

CREATE TYPE "BusinessKnowledgeCategory" AS ENUM ('BUSINESS_OVERVIEW', 'SERVICE', 'PRODUCT', 'PRICING', 'BUSINESS_HOURS', 'LOCATION', 'SERVICE_AREA', 'FAQ', 'BOOKING_CONTACT', 'REFUND_POLICY', 'CANCELLATION_POLICY', 'OTHER_POLICY', 'ADDITIONAL');

CREATE TABLE "BusinessKnowledgeEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "category" "BusinessKnowledgeCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "BusinessKnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessKnowledgeEntry_organizationId_status_category_updatedAt_idx" ON "BusinessKnowledgeEntry"("organizationId", "status", "category", "updatedAt");
CREATE INDEX "BusinessKnowledgeEntry_organizationId_title_idx" ON "BusinessKnowledgeEntry"("organizationId", "title");
ALTER TABLE "BusinessKnowledgeEntry" ADD CONSTRAINT "BusinessKnowledgeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessKnowledgeEntry" ADD CONSTRAINT "BusinessKnowledgeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessKnowledgeEntry" ADD CONSTRAINT "BusinessKnowledgeEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessKnowledgeEntry" ADD CONSTRAINT "BusinessKnowledgeEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
