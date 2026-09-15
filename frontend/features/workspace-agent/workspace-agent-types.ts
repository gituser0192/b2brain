export type AgentOutput = {
  answer: string; duplicate?: boolean; cancelled?: boolean; needsConfirmation?: boolean; metrics?: { label: string; value: number | null; availability?: "VERIFIED" | "NO_DATA" | "UNAVAILABLE" | "FORBIDDEN" | "FAILED" }[];
  warnings?: string[]; suggestions?: string[];
  health?: { overall: number | null; components: { name: string; score: number; evidence: string }[]; warnings: string[]; recommendations: string[]; period: string };
  finance?: { currency: string; current: { revenue: number; expenses: number; profit: number }; margin: number | null; score: number | null };
  forecast?: { method: string; dateRange: string; confidence: string; assumptions: string[] };
  records?: { type: string; id: string; label: string }[];
  toolResults?: AgentToolResult[];
  escalation?: { id: string; requestNumber: string; status: string };
  setup?: { step: string; completed: boolean };
  setupAssessment?: { refused?: boolean; counts?: { complete: number; actionRequired: number; externalAuthorization: number; optional?: number }; steps: { key: string; name: string; status: string; optional?: boolean; why: string; customerMust: string; href: string; testMode?: boolean }[]; currentStep?: { key: string; name: string; status: string } | null; mutationPerformed?: false; externalCallPerformed?: false };
  publicResult?: { toolName: string; availability: "VERIFIED" | "UNAVAILABLE" | "FAILED"; provenance: "CALCULATION" | "EXTERNAL_SOURCE"; answer: string; external: boolean; retrievedAt?: string; source?: { name: string; url: string; updatedAt?: string }; details?: Record<string, string | number> };
  managementSection?: "brief" | "goals" | "conversation";
  confirmation?: { action: "CUSTOMER_CREATE" | "HUMAN_ESCALATION" | "TOOL_ACTION"; token: string; expiresAt: string; preview: { name?: string; phone?: string; type?: string; status?: string; category?: string; priority?: string; targetLabel?: string; changes?: Record<string, string>; consequence?: string; externalEffect?: false; href?: string } };
  actionResult?: { toolName: string; status: "COMPLETED" | "ALREADY_COMPLETED"; label: string; href: string; externalEffect: false };
  clarification?: { token: string; expiresAt: string; resolvedDate?: string; choices: { label: string; request: string }[] };
  provenance?: "ORGANIZATION_DATA" | "CALCULATION" | "GENERAL_KNOWLEDGE" | "INFERENCE";
  reasoning?: { source: "REAL_AI" | "DETERMINISTIC_FALLBACK"; confidence: "LOW" | "MEDIUM" | "HIGH"; evidence: { id: string; label: string; value: string | number | null; period: string }[]; conclusions: string[]; recommendations: { action: string; reason: string; expectedImpact: string }[]; assumptions: string[]; missingData: string[]; proposedToolActions: string[]; requiresConfirmation: boolean; requiresHumanEscalation: boolean };
};
export type AgentToolResult = {
  toolName: string; service: string; provenance: "ORGANIZATION_DATA" | "CALCULATION" | "INFERENCE";
  retrievedAt: string; availability: "VERIFIED" | "NO_DATA" | "UNAVAILABLE" | "FORBIDDEN" | "FAILED";
  resultCount: number; totalCount?: number; truncated: boolean; period?: string; currency?: string;
  records: { type: string; id: string; label: string; status?: string; date?: string | null; amount?: number; currency?: string; reason?: string; href?: string }[];
};
export type AgentItem = { id: string; createdAt: string; message: string; output: AgentOutput };
export type BusinessBrief = {
  generatedAt: string; comparisonPeriod: string; complete: boolean; executiveSummary: string; ruleVersion: string;
  priorities: { key: string; title: string; reason: string; service: string; severity: "HIGH" | "MEDIUM" | "LOW"; value?: number; currency?: string; date?: string | null; evidence: string; href: string; provenance: string; retrievedAt: string }[];
  changes: { key: string; title: string; service: string; occurredAt: string; href: string; evidence: string }[];
  recommendations: { title: string; reason: string; href: string; action: null }[];
  coverage: { source: string; service: string; status: "VERIFIED" | "NO_DATA" | "UNAVAILABLE" | "FORBIDDEN" | "FAILED"; retrievedAt: string }[];
  coverageSummary: { checked: number; unavailable: number; forbidden: number; failed: number; noData: number; retrievedAt: string };
  mutationPerformed: false; externalCallPerformed: false;
};
export type BusinessGoal = { id: string; type: string; title: string; targetValue: number; currentValue: number | null; progress: number | null; requiredPace: number | null; risk: string; periodEnd: string };
export type GoalDraft = { type: string; title: string; targetValue: number; periodStart: string; periodEnd: string };
export type AgentSection = "brief" | "goals" | "conversation";
