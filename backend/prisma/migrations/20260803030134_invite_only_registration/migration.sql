-- CreateTable
CREATE TABLE "PlatformInvitation" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvitation_tokenHash_key" ON "PlatformInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformInvitation_email_status_idx" ON "PlatformInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "PlatformInvitation_status_expiresAt_idx" ON "PlatformInvitation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PlatformInvitation_invitedById_idx" ON "PlatformInvitation"("invitedById");

-- AddForeignKey
ALTER TABLE "PlatformInvitation" ADD CONSTRAINT "PlatformInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
