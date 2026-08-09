-- Replace global role-code uniqueness with organization-scoped uniqueness.
-- System templates retain distinct codes and organization roles become tenant-owned.
DROP INDEX "Role_code_key";
DROP INDEX "Role_organizationId_isSystem_idx";

CREATE UNIQUE INDEX "Role_organizationId_code_key" ON "Role"("organizationId", "code");
CREATE INDEX "Role_code_isSystem_idx" ON "Role"("code", "isSystem");
