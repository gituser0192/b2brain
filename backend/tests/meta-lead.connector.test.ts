import { describe, expect, it } from "vitest";
import { connectorSchema, metaLeadConnectorSchema } from "../src/modules/automation-bridge/bridge.validation.js";

describe("Meta Lead connector mapping", () => {
  it("keeps Page IDs as bounded digit strings", () => { const parsed = metaLeadConnectorSchema.parse({ pageId: "001234567890123456789", allowedFormIds: [], pageAccessToken: "synthetic-page-access-token" }); expect(parsed.pageId).toBe("001234567890123456789"); });
  it("rejects Page mapping through generic or non-Meta connector input", () => { expect(() => connectorSchema.parse({ name: "Website", type: "WEBSITE", provider: "CUSTOM", externalAccountRef: null, status: "DRAFT", mode: "MANUAL_APPROVAL", metaPageId: "123" })).toThrow(); expect(() => metaLeadConnectorSchema.parse({ pageId: "phone-123", allowedFormIds: [], pageAccessToken: "synthetic-page-access-token" })).toThrow(); });
});
