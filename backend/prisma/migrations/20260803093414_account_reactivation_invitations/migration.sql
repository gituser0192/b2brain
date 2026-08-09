-- CreateEnum
CREATE TYPE "PlatformInvitationType" AS ENUM ('NEW_ORGANIZATION', 'REACTIVATE_ORGANIZATION');

-- AlterTable
ALTER TABLE "PlatformInvitation" ADD COLUMN     "organizationId" UUID,
ADD COLUMN     "type" "PlatformInvitationType" NOT NULL DEFAULT 'NEW_ORGANIZATION';

-- CreateIndex
CREATE INDEX "PlatformInvitation_organizationId_idx" ON "PlatformInvitation"("organizationId");

-- AddForeignKey
ALTER TABLE "PlatformInvitation" ADD CONSTRAINT "PlatformInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
