import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const sql = readFileSync(new URL("../prisma/migrations/20260908193349_add_unique_whatsapp_phone_number_connector_mapping/migration.sql", import.meta.url), "utf8");

describe("WhatsApp Phone Number ID mapping migration", () => {
  it("adds only the nullable string unique index", () => {
    expect(schema).toMatch(/whatsappPhoneNumberId\s+String\?\s+@unique/);
    expect(sql).toContain('CREATE UNIQUE INDEX "IntegrationConnector_whatsappPhoneNumberId_key" ON "IntegrationConnector"("whatsappPhoneNumberId")');
    expect(sql).not.toMatch(/DROP|CREATE TABLE|ALTER TABLE|UPDATE|DELETE|TRUNCATE|RENAME/i);
  });
});
