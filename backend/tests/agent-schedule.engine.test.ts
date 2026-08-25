import { describe, expect, it } from "vitest";
import { nextDailyOccurrence } from "../src/modules/agents/agent-schedule.engine.js";
describe("agent schedule timing", () => {
  it("calculates the next Asia/Kolkata occurrence", () => expect(nextDailyOccurrence("Asia/Kolkata", "09:00", new Date("2026-08-23T02:00:00.000Z")).toISOString()).toBe("2026-08-23T03:30:00.000Z"));
  it("moves to tomorrow after today's local time", () => expect(nextDailyOccurrence("Asia/Kolkata", "09:00", new Date("2026-08-23T04:00:00.000Z")).toISOString()).toBe("2026-08-24T03:30:00.000Z"));
});
