import { normalizeWorkspaceRequest, resolveRelativeDate } from "./workspace-agent.language.js";

export type WorkspaceAgentIntent = "BUSINESS_READ" | "DAILY_BRIEF" | "GOAL_CREATE" | "GOAL_LIST" | "NEW_CUSTOMERS" | "OVERDUE_WORK" | "CUSTOMER_CREATE" | "CUSTOMER_COUNT" | "BUSINESS_HEALTH" | "FINANCE_SUMMARY" | "FORECAST" | "AI_ANALYSIS" | "PRODUCT_HELP" | "SETUP_GUIDANCE" | "HUMAN_ESCALATION" | "CONVERSATIONAL_FALLBACK";
export type ProcessingPath = "DETERMINISTIC_TOOL" | "PRODUCT_HELP" | "WRITE_ACTION" | "HUMAN_ESCALATION" | "DETERMINISTIC_FALLBACK" | "AI_ANALYSIS";
export type RouteConfidence = "HIGH" | "MEDIUM" | "LOW";
export type WorkspaceRoute = { intent: WorkspaceAgentIntent; path: ProcessingPath; aiRequired: boolean; confidence: RouteConfidence; normalizedRequest: string; ambiguity: "NONE" | "CLARIFICATION_REQUIRED"; candidateCapability?: string; missingRequiredFields?: string[]; parsedArguments?: Record<string, string>; clarification?: { question: string; choices: { label: string; request: string }[] }; resolvedDate?: { expression: string; date: string }; provenance: "ORGANIZATION_DATA" | "CALCULATION" | "GENERAL_KNOWLEDGE" | "INFERENCE"; toolName?: string; toolInput?: { query?: string; limit?: number; id?: string; period?: "THIS_MONTH" }; toolNames?: string[] };

const result = (normalizedRequest: string, intent: WorkspaceAgentIntent, path: ProcessingPath, extra: Partial<WorkspaceRoute> = {}): WorkspaceRoute => ({ intent, path, aiRequired: intent === "AI_ANALYSIS", confidence: "HIGH", ambiguity: "NONE", normalizedRequest, provenance: path === "PRODUCT_HELP" ? "GENERAL_KNOWLEDGE" : "ORGANIZATION_DATA", ...extra });

export function routeWorkspaceRequest(message: string): WorkspaceRoute {
  const normalized = normalizeWorkspaceRequest(message), value = normalized.normalized, date = resolveRelativeDate(normalized.normalized);
  if (!normalized.safe) return result(value, "CONVERSATIONAL_FALLBACK", "DETERMINISTIC_FALLBACK", { confidence: "LOW", provenance: "GENERAL_KNOWLEDGE" });
  if (/(why.*business health.*(?:fall|chang)|explain.*financial score|practical plan.*revenue goal|pehle kya improve|पहले.*(?:सुधार|बेहतर)|व्यवसाय.*(?:क्यों|गिर))/i.test(value)) return result(value, "AI_ANALYSIS", "AI_ANALYSIS");
  if (/(?:create|add|set).*(?:measurable )?goal|(?:measurable )?goal.*(?:create|add|set)/i.test(value)) return result(value, "GOAL_CREATE", "WRITE_ACTION");
  if (/(new customers?|new leads?|how many new leads|नई लीड|नए ग्राहक)/i.test(value)) return result(value, "NEW_CUSTOMERS", "DETERMINISTIC_TOOL", date ? { resolvedDate: date } : {});
  const detail = value.match(/(?:open|show|detail(?:s)?(?: for)?)\s+(customer|lead|deal|project|invoice|action)\s+([0-9a-f]{8}-[0-9a-f-]{27,})/i);
  if (detail) {
    const names: Record<string, string> = { customer: "crm.customer_detail", lead: "leads.detail", deal: "sales.deal_detail", project: "projects.detail", invoice: "finance.invoice_detail", action: "actions.detail" };
    return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: names[detail[1]!.toLowerCase()]!, toolInput: { id: detail[2]! } });
  }
  const search = value.match(/(?:find|search(?: for)?|show)\s+(?:customer|client|lead|deal|project|invoice)\s+(.+?)[.!?]*$/i)?.[1]?.trim();
  if (/(what needs my attention|biggest business risks?|leads?, projects? or invoices?.*overdue)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolNames: ["leads.needing_follow_up", "projects.overdue_tasks", "finance.overdue_invoices"] });
  if (/(business summary|summary of my business)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolNames: ["analysis.health", "sales.pipeline_summary", "finance.summary"] });
  if (/(customers?|clients?).*(?:added|created).*(?:this month)|(?:this month).*(?:customers?|clients?).*(?:added|created)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "crm.customer_list", toolInput: { period: "THIS_MONTH" } });
  if (/(action centre|recommendations?|priority actions?)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: /priority/i.test(value) ? "actions.priority" : "actions.open" });
  if (/(business risks?|health score low|why.*health)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: /risk/i.test(value) ? "analysis.risks" : "analysis.health", provenance: "CALCULATION" });
  if (/(unpaid|overdue).*invoice|invoice.*(?:unpaid|overdue)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "finance.overdue_invoices" });
  if (/(money|amount|balance).*(?:outstanding|unpaid)|(?:outstanding|unpaid).*(money|amount|balance)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "finance.summary", provenance: "CALCULATION" });
  if (search && /invoice/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "finance.invoice_search", toolInput: { query: search } });
  if (search && /project/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "projects.search", toolInput: { query: search } });
  if (search && /deal/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "sales.deal_search", toolInput: { query: search } });
  if (search && /lead/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "leads.search", toolInput: { query: search } });
  if (search && /(?:customer|client)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "crm.customer_search", toolInput: { query: search } });
  if (/(leads?.*(?:follow.?up|attention)|follow.?up.*leads?)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "leads.needing_follow_up" });
  if (/(show|list).*(?:new|open|recent)?\s*leads?|recent inquiries/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "leads.list" });
  if (/(active|open).*sales deals?|sales deals?.*(active|open)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "sales.deal_list" });
  if (/(sales pipeline|pipeline summary)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "sales.pipeline_summary", provenance: "CALCULATION" });
  if (/(show|list).*(?:customers?|clients?)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "crm.customer_list" });
  if (/(show|list).*(?:projects?)/i.test(value)) return result(value, "BUSINESS_READ", "DETERMINISTIC_TOOL", { toolName: "projects.list" });
  if (/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(value)) return result(value, "CONVERSATIONAL_FALLBACK", "DETERMINISTIC_FALLBACK", { confidence: "MEDIUM", ambiguity: "CLARIFICATION_REQUIRED", clarification: { question: "Which date did you mean? Please use a month name, for example 5 September 2026.", choices: [] } });
  if (/(today'?s (?:business )?brief|daily brief|review today|aaj ka daily brief)/i.test(value)) return result(value, "DAILY_BRIEF", "DETERMINISTIC_TOOL", date ? { resolvedDate: date } : {});
  if (/(?:create|add|set).*(?:measurable )?goal|(?:measurable )?goal.*(?:create|add|set)/i.test(value)) return result(value, "GOAL_CREATE", "WRITE_ACTION");
  if (/^(?:show |review |open )?(?:my |business )?goals[.!?\s]*$/i.test(value)) return result(value, "GOAL_LIST", "DETERMINISTIC_TOOL");
  if (/(new customers?|new leads?|how many new leads|नई लीड|नए ग्राहक)/i.test(value)) return result(value, "NEW_CUSTOMERS", "DETERMINISTIC_TOOL", date ? { resolvedDate: date } : {});
  if (/(overdue.*(?:follow[- ]?ups?|tasks?)|(?:follow[- ]?ups?|tasks?).*overdue|which project.*delay|follow ups.*show|फॉलो.?अप)/i.test(value)) return result(value, "OVERDUE_WORK", "DETERMINISTIC_TOOL", date ? { resolvedDate: date } : {});
  if (/add\s+.+(?:phone|\d{7,}).*(?:crm|customer)|add\s+.+\d{7,}|crm.*\d{7,}.*add/i.test(value)) return result(value, "CUSTOMER_CREATE", "WRITE_ACTION");
  if (!/^how\b/i.test(value) && /(?:customer.*add karo|add.*customer|customer add|rahul ko customer)/i.test(value)) return result(value, "CUSTOMER_CREATE", "WRITE_ACTION", { confidence: "MEDIUM", ambiguity: "CLARIFICATION_REQUIRED", candidateCapability: "CUSTOMER_CREATE", missingRequiredFields: ["phone"], clarification: { question: "What phone number should I use? I will show a separate action preview before creating the customer.", choices: [] } });
  if (/(?:task.*(?:create|add|bana)|(?:create|add).*task)/i.test(value)) return result(value, "CONVERSATIONAL_FALLBACK", "DETERMINISTIC_FALLBACK", { confidence: "MEDIUM", ambiguity: "CLARIFICATION_REQUIRED", candidateCapability: "TASKS", clarification: { question: "Task creation is not supported by the current Agent capability. You can create it safely in Projects.", choices: [] }, ...(date ? { resolvedDate: date } : {}) });
  if (/(?:count|total|how many|number of).*(?:customer|client)|(?:customer|client).*(?:count|total|how many|number of)|मेरे कितने ग्राहक|कितने ग्राहक/i.test(value)) return result(value, "CUSTOMER_COUNT", "DETERMINISTIC_TOOL");
  if (/(business health|what is going on|how is (?:my|the) business (?:performing|doing)|business health kaisi|व्यवसाय.*कैसा)/i.test(value)) return result(value, "BUSINESS_HEALTH", "DETERMINISTIC_TOOL");
  if (/(predict|forecast|next month|agle mahine)/i.test(value)) return result(value, "FORECAST", "DETERMINISTIC_TOOL", { ...(date ? { resolvedDate: date } : {}), provenance: "CALCULATION" });
  if (/(what should i improve|why.*(?:revenue|profit|business).*(?:down|low)|(?:analyse|analyze|explain).*(?:business|performance|forecast)|business strategy|action plan|growth strategy|kya improve|kaise improve|sudhar|strategy)/i.test(value)) return result(value, "AI_ANALYSIS", "AI_ANALYSIS");
  if (/(financial score|revenue|expense|profit|finance summary|payment.*pending|payment.*how many|पैसे|लाभ|खर्च)/i.test(value)) return result(value, "FINANCE_SUMMARY", "DETERMINISTIC_TOOL", { ...(date ? { resolvedDate: date } : {}), provenance: "CALCULATION" });
  if (/(how do i add a customer|how.*crm|kaise.*crm|crm.*kaise|explain b2|what can b2)/i.test(value)) return result(value, "PRODUCT_HELP", "PRODUCT_HELP");
  if (/(help me set up|agent setup|set up my business agent|setup.*help|setup.*madad)/i.test(value)) return result(value, "SETUP_GUIDANCE", "PRODUCT_HELP");
  if (/(delete|refund|payment reversal|legal|credential|security problem|human.*talk|human se baat|another organization|organization b|other company|private internal)/i.test(value)) return result(value, "HUMAN_ESCALATION", "HUMAN_ESCALATION");
  if (/(that customer|the (?:first|second|third) one|show me more|what about last month|only finance|his pending follow up)/i.test(value)) return result(value, "CONVERSATIONAL_FALLBACK", "DETERMINISTIC_FALLBACK", { confidence: "MEDIUM", ambiguity: "CLARIFICATION_REQUIRED", clarification: { question: "What should I apply that follow-up to?", choices: [{ label: "CRM customers", request: "Count all CRM customers" }, { label: "Finance summary", request: "Show my finance summary" }, { label: "Today's priorities", request: "Show today's business brief" }] } });
  return result(value, "CONVERSATIONAL_FALLBACK", "DETERMINISTIC_FALLBACK", { confidence: "LOW", provenance: "GENERAL_KNOWLEDGE" });
}
