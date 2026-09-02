export type AgentOutput = {
  answer: string; duplicate?: boolean; metrics?: { label: string; value: number }[];
  warnings?: string[]; suggestions?: string[];
  health?: { overall: number | null; components: { name: string; score: number; evidence: string }[]; warnings: string[]; recommendations: string[]; period: string };
  finance?: { currency: string; current: { revenue: number; expenses: number; profit: number }; margin: number | null; score: number | null };
  forecast?: { method: string; dateRange: string; confidence: string; assumptions: string[] };
  records?: { type: string; id: string; label: string }[];
  escalation?: { id: string; requestNumber: string; status: string };
  setup?: { step: string; completed: boolean };
  managementSection?: "brief" | "goals" | "conversation";
  reasoning?: { source: "REAL_AI" | "DETERMINISTIC_FALLBACK"; confidence: "LOW" | "MEDIUM" | "HIGH"; evidence: { id: string; label: string; value: string | number | null; period: string }[]; conclusions: string[]; recommendations: { action: string; reason: string; expectedImpact: string }[]; assumptions: string[]; missingData: string[]; proposedToolActions: string[]; requiresConfirmation: boolean; requiresHumanEscalation: boolean };
};
export type AgentItem = { id: string; createdAt: string; message: string; output: AgentOutput };
export type BusinessBrief = {
  calculatedAt: string; period: string; meaningful: boolean;
  health: { score: number | null; change: number | null; missingData: string[] };
  finance: { revenue: number; expenses: number; profit: number; previousRevenue: number; previousExpenses: number; previousProfit: number } | null;
  activity: { newCustomers: number | null; newLeads: number | null; overdueFollowUps: number | null; overdueTasks: number | null; atRiskProjects: number; importantServiceRequests: number | null };
  alerts: { code: string; title: string; why: string; evidence: string; period: string; severity: string; action: string; view: string }[];
  recommendations: { title: string; reason: string; view: string }[];
};
export type BusinessGoal = { id: string; type: string; title: string; targetValue: number; currentValue: number | null; progress: number | null; requiredPace: number | null; risk: string; periodEnd: string };
export type AgentSection = "brief" | "goals" | "conversation";
