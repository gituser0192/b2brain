import { describe, expect, it } from "vitest";
import { salesQueueQuerySchema } from "../src/modules/sales-work-queue/sales-work-queue.validation.js";

describe("sales work queue validation", () => {
  it("uses a team-wide 30-day queue by default", () => expect(salesQueueQuerySchema.parse({})).toEqual({ scope: "TEAM", horizonDays: 30 }));
  it("accepts a personal queue with a controlled horizon", () => expect(salesQueueQuerySchema.parse({ scope: "MINE", horizonDays: "14" })).toEqual({ scope: "MINE", horizonDays: 14 }));
  it("rejects unbounded queue horizons", () => expect(() => salesQueueQuerySchema.parse({ horizonDays: "365" })).toThrow());
  it("rejects tenant identifiers from query input", () => expect(() => salesQueueQuerySchema.parse({ organizationId: crypto.randomUUID() })).toThrow());
});
