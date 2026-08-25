import { describe, expect, it } from "vitest";
import { defaultEmailPolicy, emailPolicy, isQuietHours } from "../src/modules/automation-bridge/email-policy.engine.js";
describe("email delivery policy", () => {
  it("defaults to manual approval delivery", () => expect(emailPolicy({}).mode).toBe("MANUAL"));
  it("detects overnight quiet hours", () => { expect(isQuietHours(defaultEmailPolicy, new Date("2026-08-23T17:30:00.000Z"))).toBe(true); expect(isQuietHours(defaultEmailPolicy, new Date("2026-08-23T08:00:00.000Z"))).toBe(false); });
  it("honors the emergency pause setting", () => expect(emailPolicy({ emailDeliveryPolicy: { ...defaultEmailPolicy, emergencyPaused: true } }).emergencyPaused).toBe(true));
});
