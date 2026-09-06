import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const sql = readFileSync(new URL("../prisma/migrations/20260906120000_add_meta_page_connector_mapping/migration.sql", import.meta.url), "utf8");
describe("Meta Page connector migration", () => {
  it("adds only a nullable exact-string Page ID and unique index", () => { expect(schema).toContain("metaPageId"); expect(schema).toMatch(/metaPageId\s+String\?\s+@unique/); expect(sql).toMatch(/ADD COLUMN "metaPageId" TEXT/); expect(sql).toMatch(/CREATE UNIQUE INDEX "IntegrationConnector_metaPageId_key"/); expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE|ALTER COLUMN/i); });
});
