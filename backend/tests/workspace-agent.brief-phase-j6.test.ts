import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRIEF_LIMITS, BRIEF_RULE_VERSION, composeOperatingBrief, previousBusinessDayPeriod } from "../src/modules/workspace-agent/workspace-agent.brief.js";
import { routeWorkspaceRequest } from "../src/modules/workspace-agent/workspace-agent.router.js";

const read = vi.fn();

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: [] };
const result = (name = "unknown", records: Array<Record<string, unknown>> = [], availability = "VERIFIED") => ({ toolName: name, service: name.startsWith("finance") ? "FINANCE" : name.startsWith("projects") ? "PROJECTS" : name.startsWith("crm") ? "CRM" : name.startsWith("leads") ? "LEADS" : name.startsWith("sales") ? "SALES" : name.startsWith("analysis") ? "BUSINESS_ANALYSIS" : "ACTION_CENTRE", provenance: "ORGANIZATION_DATA", retrievedAt: "2026-09-15T04:30:00.000Z", availability, resultCount: records.length, totalCount: records.length, appliedFilters: {}, truncated: false, records });

describe("J6 deterministic operating brief", () => {
  beforeEach(() => read.mockImplementation((_context, name: string) => Promise.resolve(result(name))));

  it("uses the ten bounded J3 sources without mutations or public tools", async () => {
    const brief = await composeOperatingBrief(context, read);
    expect(read).toHaveBeenCalledTimes(11);
    expect(read.mock.calls.every((call) => !String(call[1]).startsWith("public."))).toBe(true);
    expect(brief).toMatchObject({ ruleVersion: BRIEF_RULE_VERSION, mutationPerformed: false, externalCallPerformed: false });
  });

  it.each(["What needs my attention today?", "Give me my morning brief.", "Aaj kya important hai?", "What changed since yesterday?", "What should I do first?", "Summarize my business."])("routes the operating-brief request: %s", (message) => expect(routeWorkspaceRequest(message).intent).toBe("DAILY_BRIEF"));

  it("caps and stably orders priorities with no more than three per service", async () => {
    read.mockImplementation((_context, name: string) => Promise.resolve(result(name, name === "finance.overdue_invoices" ? Array.from({ length: 8 }, (_, index) => ({ type: "INVOICE", id: `invoice-${index}`, label: `Invoice ${index}`, status: "OVERDUE", date: "2026-09-01T00:00:00.000Z", amount: 1000 + index, href: "/finance" })) : name === "projects.overdue_tasks" ? Array.from({ length: 8 }, (_, index) => ({ type: "TASK", id: `task-${index}`, label: `Task ${index}`, status: "OVERDUE", date: "2026-09-01T00:00:00.000Z", href: "/projects" })) : [])));
    const brief = await composeOperatingBrief(context, read);
    expect(brief.priorities).toHaveLength(6);
    expect(brief.priorities.filter((item) => item.service === "FINANCE")).toHaveLength(BRIEF_LIMITS.perService);
    expect(brief.priorities.length).toBeLessThanOrEqual(BRIEF_LIMITS.priorities);
    expect(new Set(brief.priorities.map((item) => item.key)).size).toBe(brief.priorities.length);
  });

  it("discloses partial access and never calls a failed source zero", async () => {
    read.mockImplementation((_context, name?: string) => { const tool = name ?? "unknown"; return Promise.resolve(result(tool, [], tool.startsWith("finance") ? "FORBIDDEN" : tool.startsWith("analysis") ? "FAILED" : "NO_DATA")); });
    const brief = await composeOperatingBrief(context, read);
    expect(brief.complete).toBe(false);
    expect(brief.coverageSummary).toMatchObject({ forbidden: 1, failed: 1 });
    expect(brief.executiveSummary).toContain("partial");
  });

  it("uses exact Asia/Kolkata previous-business-day boundaries", () => {
    expect(previousBusinessDayPeriod(new Date("2026-09-14T04:30:00.000Z"))).toEqual({ start: new Date("2026-09-10T18:30:00.000Z"), end: new Date("2026-09-13T18:30:00.000Z"), label: "2026-09-10T18:30:00.000Z to 2026-09-13T18:30:00.000Z (Asia/Kolkata)" });
  });
});
