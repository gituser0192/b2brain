import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8"), sql = readFileSync(new URL("../prisma/migrations/20260906163832_add_integration_authorization_state/migration.sql", import.meta.url), "utf8");
describe("Integration authorization state migration", () => { it("is additive, hashed, indexed and cascading", () => { expect(schema).toMatch(/stateHash\s+String\s+@unique/); expect(sql).toContain('CREATE TABLE "IntegrationAuthorizationState"'); expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(4); expect(sql).toContain('IntegrationAuthorizationState_stateHash_key'); expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE FROM|RENAME|ALTER COLUMN/i); }); });
