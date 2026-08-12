CREATE TABLE "MembershipServiceAccess" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipServiceAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipServiceAccess_membershipId_serviceId_key" ON "MembershipServiceAccess"("membershipId", "serviceId");
CREATE INDEX "MembershipServiceAccess_organizationId_membershipId_idx" ON "MembershipServiceAccess"("organizationId", "membershipId");
CREATE INDEX "MembershipServiceAccess_organizationId_serviceId_idx" ON "MembershipServiceAccess"("organizationId", "serviceId");
CREATE INDEX "MembershipServiceAccess_createdById_idx" ON "MembershipServiceAccess"("createdById");
CREATE INDEX "MembershipServiceAccess_updatedById_idx" ON "MembershipServiceAccess"("updatedById");

ALTER TABLE "MembershipServiceAccess" ADD CONSTRAINT "MembershipServiceAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipServiceAccess" ADD CONSTRAINT "MembershipServiceAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipServiceAccess" ADD CONSTRAINT "MembershipServiceAccess_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipServiceAccess" ADD CONSTRAINT "MembershipServiceAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipServiceAccess" ADD CONSTRAINT "MembershipServiceAccess_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
