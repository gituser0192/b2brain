-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('MANAGER', 'CONTRIBUTOR', 'VIEWER');

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_organizationId_projectId_deletedAt_idx" ON "ProjectMember"("organizationId", "projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProjectMember_organizationId_membershipId_deletedAt_idx" ON "ProjectMember"("organizationId", "membershipId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_membershipId_key" ON "ProjectMember"("projectId", "membershipId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
