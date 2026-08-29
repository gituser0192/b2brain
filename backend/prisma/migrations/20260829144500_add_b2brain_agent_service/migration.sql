INSERT INTO "Service" (
  "id",
  "code",
  "name",
  "description",
  "status",
  "iconKey",
  "routePath",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'B2BRAIN_AGENT',
  'Ask B² Brain',
  'Organization-scoped business operating agent for authenticated workspace users.',
  'ACTIVE',
  '✦',
  '/dashboard?view=b2agent',
  5,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "status" = 'ACTIVE',
  "iconKey" = EXCLUDED."iconKey",
  "routePath" = EXCLUDED."routePath",
  "sortOrder" = EXCLUDED."sortOrder",
  "archivedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;
