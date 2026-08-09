-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "MembershipInvitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipInvitation_tokenHash_key" ON "MembershipInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "MembershipInvitation_organizationId_status_idx" ON "MembershipInvitation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MembershipInvitation_email_status_idx" ON "MembershipInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "MembershipInvitation_roleId_idx" ON "MembershipInvitation"("roleId");

-- CreateIndex
CREATE INDEX "MembershipInvitation_invitedById_idx" ON "MembershipInvitation"("invitedById");

-- CreateIndex
CREATE INDEX "MembershipInvitation_expiresAt_idx" ON "MembershipInvitation"("expiresAt");

-- AddForeignKey
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
