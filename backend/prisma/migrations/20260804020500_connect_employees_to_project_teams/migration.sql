ALTER TABLE "ProjectMember" ALTER COLUMN "membershipId" DROP NOT NULL;
ALTER TABLE "ProjectMember" ADD COLUMN "employeeId" UUID;
ALTER TABLE "ProjectMember" ADD COLUMN "roleLabel" TEXT;

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProjectMember_projectId_employeeId_key"
ON "ProjectMember"("projectId", "employeeId");
