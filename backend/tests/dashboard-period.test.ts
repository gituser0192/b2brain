import { describe, expect, it } from "vitest";
import { dashboardMonths, monthKey } from "../src/modules/dashboard/dashboard-period.js";

describe("dashboard organization month boundaries", () => {
  it("uses the organization's timezone for current month", () => {
    const period = dashboardMonths(new Date("2026-08-31T20:00:00.000Z"), "Asia/Kolkata");
    expect(period.currentStart.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(period.currentEnd.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(monthKey(period.currentStart, "Asia/Kolkata")).toBe("2026-09");
  });
});
