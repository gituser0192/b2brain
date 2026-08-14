ALTER TABLE "Organization" ADD COLUMN "isServiceProvider" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Organization" AS organization SET "isServiceProvider" = true
WHERE EXISTS (
  SELECT 1 FROM "OrganizationMembership" membership
  JOIN "User" account ON account."id" = membership."userId"
  WHERE membership."organizationId" = organization."id" AND membership."status" = 'ACTIVE' AND account."isPlatformAdmin" = true
);

INSERT INTO "Permission" ("id", "code", "name", "description") VALUES
  (gen_random_uuid(), 'PROVIDER_REQUEST_VIEW', 'View B2 Brain service requests', 'View customer-approved requests in the B2 Brain delivery desk'),
  (gen_random_uuid(), 'PROVIDER_REQUEST_WORK', 'Work B2 Brain service requests', 'Reply, add internal notes, and progress assigned customer requests'),
  (gen_random_uuid(), 'PROVIDER_REQUEST_MANAGE', 'Manage B2 Brain service desk', 'Assign, reassign, prioritize, and manage service requests'),
  (gen_random_uuid(), 'PROVIDER_SENSITIVE_APPROVE', 'Approve sensitive provider actions', 'Approve plan, billing, finance, deployment, and other sensitive service actions')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id" FROM "Role" role CROSS JOIN "Permission" permission
WHERE role."organizationId" IS NULL AND role."code" = 'ORGANIZATION_OWNER'
AND permission."code" IN ('PROVIDER_REQUEST_VIEW', 'PROVIDER_REQUEST_WORK', 'PROVIDER_REQUEST_MANAGE', 'PROVIDER_SENSITIVE_APPROVE')
ON CONFLICT DO NOTHING;

INSERT INTO "Role" ("id", "organizationId", "code", "name", "description", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), organization."id", preset.code, preset.name, preset.description, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" organization
CROSS JOIN (VALUES
  ('B2_SERVICE_DESK_MANAGER', 'Service Desk Manager', 'Assigns work, manages delivery, and approves controlled service-desk actions'),
  ('B2_SUPPORT_AGENT', 'Support Agent', 'Replies to customers and works assigned support requests'),
  ('B2_WEBSITE_DEVELOPER', 'Website Developer', 'Works assigned website and development requests'),
  ('B2_MARKETING_SPECIALIST', 'Marketing Specialist', 'Works assigned marketing requests'),
  ('B2_CRM_SPECIALIST', 'CRM Specialist', 'Works assigned CRM requests'),
  ('B2_FINANCE_SPECIALIST', 'Finance Specialist', 'Works assigned finance and billing requests without approval authority'),
  ('B2_AUTOMATION_SPECIALIST', 'Automation Specialist', 'Works assigned automation and integration requests')
) AS preset(code, name, description)
WHERE organization."isServiceProvider" = true
ON CONFLICT ("organizationId", "code") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "isSystem" = true, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Organization" organization ON organization."id" = role."organizationId" AND organization."isServiceProvider" = true
JOIN "Permission" permission ON permission."code" IN ('PROVIDER_REQUEST_VIEW', 'PROVIDER_REQUEST_WORK')
WHERE role."code" IN ('B2_SERVICE_DESK_MANAGER', 'B2_SUPPORT_AGENT', 'B2_WEBSITE_DEVELOPER', 'B2_MARKETING_SPECIALIST', 'B2_CRM_SPECIALIST', 'B2_FINANCE_SPECIALIST', 'B2_AUTOMATION_SPECIALIST')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Organization" organization ON organization."id" = role."organizationId" AND organization."isServiceProvider" = true
JOIN "Permission" permission ON permission."code" IN ('PROVIDER_REQUEST_MANAGE', 'PROVIDER_SENSITIVE_APPROVE')
WHERE role."code" = 'B2_SERVICE_DESK_MANAGER'
ON CONFLICT DO NOTHING;
