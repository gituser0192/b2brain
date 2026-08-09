import { describe, expect, it } from "vitest";
import {
  createActivitySchema,
  createFollowUpSchema,
  listFollowUpsQuerySchema,
  updateFollowUpStatusSchema,
} from "../src/modules/customer-engagement/engagement.validation.js";

describe("customer engagement validation", () => {
  it("normalizes an activity and converts its timestamp", () => {
    const result = createActivitySchema.parse({
      type: "CALL",
      summary: "  Discussed renewal  ",
      details: "",
      occurredAt: "2026-08-03T10:00:00.000Z",
    });

    expect(result.summary).toBe("Discussed renewal");
    expect(result.details).toBeNull();
    expect(result.occurredAt).toEqual(new Date("2026-08-03T10:00:00.000Z"));
  });

  it("rejects client-supplied tenant, audit, and assignment identifiers", () => {
    expect(() => createActivitySchema.parse({
      type: "NOTE",
      summary: "Private note",
      organizationId: crypto.randomUUID(),
      createdById: crypto.randomUUID(),
    })).toThrow();

    expect(() => createFollowUpSchema.parse({
      title: "Call tomorrow",
      dueAt: "2026-08-04T10:00:00.000Z",
      assignedToId: crypto.randomUUID(),
    })).toThrow();
  });

  it("parses follow-up dates and restricts status values", () => {
    const result = createFollowUpSchema.parse({
      title: "  Send proposal  ",
      dueAt: "2026-08-04T10:00:00.000Z",
    });

    expect(result.title).toBe("Send proposal");
    expect(result.dueAt).toEqual(new Date("2026-08-04T10:00:00.000Z"));
    expect(updateFollowUpStatusSchema.parse({ status: "COMPLETED" })).toEqual({ status: "COMPLETED" });
    expect(() => updateFollowUpStatusSchema.parse({ status: "DEFERRED" })).toThrow();
  });

  it("validates follow-up center filters without accepting tenant identifiers", () => {
    expect(listFollowUpsQuerySchema.parse({ assignedToMe: "true", limit: "25" })).toEqual({ assignedToMe: true, limit: 25 });
    expect(() => listFollowUpsQuerySchema.parse({ organizationId: crypto.randomUUID() })).toThrow();
    expect(() => listFollowUpsQuerySchema.parse({ limit: "101" })).toThrow();
  });
});
