import type { WorkspaceAgentContext } from "./workspace-agent.capabilities.js";
import { executeWorkspaceAgentReadTool, type AgentReadAvailability, type AgentReadRecord, type AgentToolResult } from "./workspace-agent.read-tools.js";

export const BRIEF_RULE_VERSION = "j6-v1";
export const BRIEF_LIMITS = { priorities: 7, perService: 3, changes: 10, recommendations: 5, totalTimeoutMs: 6_000 } as const;

const sources = [
  ["leads.list", "New leads"], ["leads.needing_follow_up", "Unattended leads"],
  ["crm.customer_list", "New customers"], ["crm.follow_ups_due", "Due follow-ups"],
  ["sales.deals_at_risk", "At-risk deals"], ["projects.overdue_tasks", "Overdue tasks"], ["projects.tasks_due", "Tasks due soon"],
  ["projects.at_risk", "Delayed projects"], ["finance.overdue_invoices", "Overdue invoices"],
  ["analysis.risks", "Business risks"], ["actions.priority", "Stored recommendations"],
] as const;

type Priority = { key: string; title: string; reason: string; service: string; severity: "HIGH" | "MEDIUM" | "LOW"; value?: number; currency?: string; date?: string | null; evidence: string; href: string; provenance: AgentToolResult["provenance"]; retrievedAt: string; score: number };
const daysLate = (date?: string | null, now = Date.now()) => date ? Math.max(0, Math.floor((now - new Date(date).getTime()) / 86_400_000)) : 0;
const severity = (score: number): Priority["severity"] => score >= 380 ? "HIGH" : score >= 320 ? "MEDIUM" : "LOW";
const sourceScore = (tool: string, record: AgentReadRecord) => {
  const late = daysLate(record.date), amount = Math.min(Math.max(record.amount ?? 0, 0), 1_000_000) / 10_000;
  if (tool === "finance.overdue_invoices") return 400 + late * 5 + amount;
  if (tool === "actions.priority") return 390 + ({ CRITICAL: 60, HIGH: 30 }[record.status ?? ""] ?? 0);
  if (tool === "analysis.risks") return 380 + ({ CRITICAL: 60, HIGH: 30, MEDIUM: 10 }[record.status ?? ""] ?? 0);
  if (tool === "projects.overdue_tasks") return 360 + late * 4;
  if (tool === "projects.tasks_due") return 300;
  if (tool === "projects.at_risk") return 350 + late * 4;
  if (tool === "sales.deals_at_risk") return 340 + late * 3;
  if (tool === "crm.follow_ups_due") return 330 + late * 3;
  if (tool === "leads.needing_follow_up") return 320 + late * 2;
  return 0;
};
const rankReason = (tool: string, record: AgentReadRecord, late: number) => {
  if (tool === "finance.overdue_invoices") return `${late} day${late === 1 ? "" : "s"} overdue${record.amount === undefined ? "" : ` with ${record.amount} ${record.currency ?? ""} outstanding`}.`;
  if (tool === "projects.tasks_due") return "Due within the next seven days.";
  if (["projects.overdue_tasks", "projects.at_risk", "sales.deals_at_risk", "crm.follow_ups_due", "leads.needing_follow_up"].includes(tool)) return `${late} day${late === 1 ? "" : "s"} past the verified due or activity date.`;
  return `${record.status ?? "Stored"} verified priority from ${tool.startsWith("analysis") ? "Business Analysis" : "Action Centre"}.`;
};

export function previousBusinessDayPeriod(now = new Date()) {
  const india = new Date(now.getTime() + 330 * 60_000), end = new Date(Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()) - 330 * 60_000);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 1);
  while ([0, 6].includes(new Date(start.getTime() + 330 * 60_000).getUTCDay())) start.setUTCDate(start.getUTCDate() - 1);
  return { start, end, label: `${start.toISOString()} to ${end.toISOString()} (Asia/Kolkata)` };
}

const failed = (name: string, service = "UNKNOWN"): AgentToolResult => ({ toolName: name, service: service as AgentToolResult["service"], provenance: "ORGANIZATION_DATA", retrievedAt: new Date().toISOString(), availability: "FAILED", resultCount: 0, appliedFilters: {}, truncated: false, records: [] });

export async function composeOperatingBrief(context: WorkspaceAgentContext, execute = executeWorkspaceAgentReadTool) {
  const started = Date.now(), generatedAt = new Date(), period = previousBusinessDayPeriod(generatedAt);
  const reads = Promise.all(sources.map(async ([name]) => execute(context, name, { limit: name.endsWith(".list") ? 10 : 20 }).catch(() => failed(name))));
  const results = await Promise.race([reads, new Promise<AgentToolResult[]>((resolve) => setTimeout(() => resolve(sources.map(([name]) => failed(name))), BRIEF_LIMITS.totalTimeoutMs))]);
  const byName = new Map(results.map((item) => [item.toolName, item]));
  const candidates: Priority[] = [];
  for (const [name] of sources) {
    const result = byName.get(name); if (!result || !["VERIFIED", "NO_DATA"].includes(result.availability)) continue;
    for (const record of result.records) {
      const score = sourceScore(name, record); if (!score) continue;
      const late = daysLate(record.date, generatedAt.getTime());
      candidates.push({ key: `${result.service}:${record.type}:${record.id}`, title: record.label, reason: rankReason(name, record, late), service: result.service, severity: severity(score), ...(record.amount === undefined ? {} : { value: record.amount }), ...(record.currency ? { currency: record.currency } : {}), ...(record.date === undefined ? {} : { date: record.date }), evidence: `${record.status ?? record.type}${record.reason ? ` · ${record.reason}` : ""}${record.date ? ` · ${record.date}` : ""}`, href: record.href ?? "/dashboard", provenance: result.provenance, retrievedAt: result.retrievedAt, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.service.localeCompare(b.service) || a.key.localeCompare(b.key));
  const serviceCounts = new Map<string, number>(), seen = new Set<string>(), priorities: Priority[] = [];
  for (const item of candidates) { if (seen.has(item.key) || (serviceCounts.get(item.service) ?? 0) >= BRIEF_LIMITS.perService) continue; seen.add(item.key); priorities.push(item); serviceCounts.set(item.service, (serviceCounts.get(item.service) ?? 0) + 1); if (priorities.length === BRIEF_LIMITS.priorities) break; }
  const changes = results.flatMap((result) => ["leads.list", "crm.customer_list"].includes(result.toolName) && ["VERIFIED", "NO_DATA"].includes(result.availability) ? result.records.filter((record) => record.date && new Date(record.date) >= period.start && new Date(record.date) < period.end).map((record) => ({ key: `${result.service}:${record.id}`, title: record.label, service: result.service, occurredAt: record.date!, href: record.href ?? "/dashboard", evidence: `Created during ${period.label}` })) : []).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.key.localeCompare(b.key)).slice(0, BRIEF_LIMITS.changes);
  const coverage = results.map((result) => ({ source: result.toolName, service: result.service, status: result.availability, retrievedAt: result.retrievedAt }));
  const counts = (status: AgentReadAvailability) => coverage.filter((item) => item.status === status).length;
  const complete = !coverage.some((item) => ["UNAVAILABLE", "FORBIDDEN", "FAILED"].includes(item.status));
  const named = (name: string) => byName.get(name), total = (name: string) => { const value = named(name); return value && ["VERIFIED", "NO_DATA"].includes(value.availability) ? value.totalCount ?? value.resultCount : null; };
  const changed = (name: string, service: string) => { const value = named(name); return value && ["VERIFIED", "NO_DATA"].includes(value.availability) ? changes.filter((item) => item.service === service).length : null; };
  const financeResult = named("finance.overdue_invoices");
  const analysisResult = named("analysis.risks"), healthScore = typeof analysisResult?.summary?.healthScore === "number" ? analysisResult.summary.healthScore : null;
  return {
    generatedAt: generatedAt.toISOString(), comparisonPeriod: period.label, complete, ruleVersion: BRIEF_RULE_VERSION,
    executiveSummary: priorities.length ? `${priorities.length} verified priorit${priorities.length === 1 ? "y" : "ies"} need review.` : complete ? "Nothing currently needs attention in the verified sources." : "The available sources were checked, but this brief is partial.",
    priorities, changes, recommendations: priorities.slice(0, BRIEF_LIMITS.recommendations).map((item) => ({ title: `Review ${item.title}`, reason: item.reason, href: item.href, action: null })), coverage,
    coverageSummary: { checked: coverage.length, unavailable: counts("UNAVAILABLE"), forbidden: counts("FORBIDDEN"), failed: counts("FAILED"), noData: counts("NO_DATA"), retrievedAt: generatedAt.toISOString() },
    diagnostics: { durationMs: Date.now() - started, sourceCount: coverage.length, priorityCount: priorities.length, changeCount: changes.length, complete, ruleVersion: BRIEF_RULE_VERSION },
    mutationPerformed: false as const, externalCallPerformed: false as const,
    // Compatibility fields used by the existing conversation and reasoning presentation.
    calculatedAt: generatedAt, period: `Since previous business day: ${period.label}`, meaningful: priorities.length > 0 || changes.length > 0,
    health: { score: healthScore, change: null, availability: analysisResult?.availability ?? "FAILED", missingData: coverage.filter((item) => item.status !== "VERIFIED" && item.status !== "NO_DATA").map((item) => `${item.service} is ${item.status.toLowerCase()}.`) },
    finance: null as { revenue: number; expenses: number; profit: number; previousRevenue: number; previousExpenses: number; previousProfit: number } | null,
    activity: { newCustomers: changed("crm.customer_list", "CRM"), newLeads: changed("leads.list", "LEADS"), overdueFollowUps: total("crm.follow_ups_due"), overdueTasks: total("projects.overdue_tasks"), atRiskProjects: total("projects.at_risk"), importantServiceRequests: null },
    availability: { newCustomers: named("crm.customer_list")?.availability ?? "FAILED", newLeads: named("leads.list")?.availability ?? "FAILED", overdueFollowUps: named("crm.follow_ups_due")?.availability ?? "FAILED", overdueTasks: named("projects.overdue_tasks")?.availability ?? "FAILED", atRiskProjects: named("projects.at_risk")?.availability ?? "FAILED", finance: financeResult?.availability ?? "FAILED", recommendations: named("actions.priority")?.availability ?? "FAILED" },
    alerts: priorities.map((item) => ({ code: item.key, title: item.title, why: item.reason, evidence: item.evidence, period: item.date ?? "Current verified state", severity: item.severity, action: `Review ${item.title}`, view: item.href })),
  };
}
