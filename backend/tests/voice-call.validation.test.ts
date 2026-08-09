import { describe, expect, it } from "vitest";
import { createVoiceCallSchema } from "../src/modules/voice-calls/voice-call.validation.js";

const valid = { agentId: crypto.randomUUID(), customerId: crypto.randomUUID(), language: "en-IN", objective: "Confirm the customer's interest and preferred next step.", approvedScript: "Introduce the business, disclose that this is an AI call, and ask whether now is a good time." };
describe("voice call validation", () => {
  it("accepts a safe provider-independent call plan", () => { expect(createVoiceCallSchema.parse(valid)).toMatchObject({ language: "en-IN" }); });
  it("rejects tenant, audit, provider, and transcript fields", () => { expect(() => createVoiceCallSchema.parse({ ...valid, organizationId: crypto.randomUUID() })).toThrow(); expect(() => createVoiceCallSchema.parse({ ...valid, provider: "twilio", transcript: "fake" })).toThrow(); });
  it("requires an approved script and supported language", () => { expect(() => createVoiceCallSchema.parse({ ...valid, approvedScript: "Call them" })).toThrow(); expect(() => createVoiceCallSchema.parse({ ...valid, language: "xx-XX" })).toThrow(); });
});
