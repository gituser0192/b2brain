import { describe, expect, it } from "vitest";
import {
  enrollmentSchema,
  sequenceSchema,
} from "../src/modules/follow-up-automation/follow-up-automation.validation.js";
const base = {
  name: "Warm lead",
  description: null,
  isActive: true,
  stopOnResponse: true,
  stopOnWonDeal: true,
  steps: [
    {
      stepOrder: 1,
      delayMinutes: 60,
      channel: "TASK",
      title: "Call {contactName}",
      messageTemplate: "Discuss {subject}",
      requiresApproval: false,
    },
  ],
};
describe("follow-up automation validation", () => {
  it("accepts an internal follow-up sequence", () =>
    expect(sequenceSchema.parse(base)).toMatchObject({ name: "Warm lead" }));
  it("requires approval for customer messages", () =>
    expect(() =>
      sequenceSchema.parse({
        ...base,
        steps: [
          { ...base.steps[0], channel: "WHATSAPP", requiresApproval: false },
        ],
      }),
    ).toThrow());
  it("rejects duplicate step order", () =>
    expect(() =>
      sequenceSchema.parse({ ...base, steps: [base.steps[0], base.steps[0]] }),
    ).toThrow());
  it("derives tenant context instead of accepting it", () =>
    expect(() =>
      enrollmentSchema.parse({
        sequenceId: crypto.randomUUID(),
        targetType: "INQUIRY",
        targetId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
      }),
    ).toThrow());
});
