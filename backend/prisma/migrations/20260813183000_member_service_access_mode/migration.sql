CREATE TYPE "MemberServiceAccessMode" AS ENUM ('READ_ONLY', 'READ_WRITE');
ALTER TABLE "MembershipServiceAccess" ADD COLUMN "accessMode" "MemberServiceAccessMode" NOT NULL DEFAULT 'READ_ONLY';
