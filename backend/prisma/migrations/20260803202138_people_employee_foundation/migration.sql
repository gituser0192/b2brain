-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'EXITED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "linkedUserId" UUID,
    "managerId" UUID,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "workEmail" TEXT,
    "workPhone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_organizationId_status_deletedAt_idx" ON "Employee"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Employee_organizationId_department_deletedAt_idx" ON "Employee"("organizationId", "department", "deletedAt");

-- CreateIndex
CREATE INDEX "Employee_organizationId_managerId_deletedAt_idx" ON "Employee"("organizationId", "managerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Employee_createdById_idx" ON "Employee"("createdById");

-- CreateIndex
CREATE INDEX "Employee_updatedById_idx" ON "Employee"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_employeeNumber_key" ON "Employee"("organizationId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_linkedUserId_key" ON "Employee"("organizationId", "linkedUserId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
