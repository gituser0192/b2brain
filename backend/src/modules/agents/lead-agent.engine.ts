export interface LeadAgentInput {
  source: "MANUAL" | "WEBSITE" | "WHATSAPP" | "EMAIL" | "PHONE" | "SOCIAL" | "REFERRAL" | "STORE" | "OTHER";
  contactName: string;
  subject: string;
  message: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
}

export type LeadType = "SALES" | "PRODUCT_QUESTION" | "SUPPORT" | "COMPLAINT" | "ORDER_REQUEST" | "PARTNERSHIP" | "SPAM" | "OTHER";
export type LeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const contains = (text: string, words: string[]) => words.some((word) => text.includes(word));

export function evaluateLead(input: LeadAgentInput) {
  const text = `${input.subject} ${input.message}`.toLowerCase();
  let type: LeadType = "SALES";
  let confidence = 0.7;
  if (contains(text, ["casino", "crypto giveaway", "buy followers", "seo backlink", "lottery winner"])) { type = "SPAM"; confidence = 0.98; }
  else if (contains(text, ["complaint", "angry", "unacceptable", "fraud", "refund now"])) { type = "COMPLAINT"; confidence = 0.94; }
  else if (contains(text, ["not working", "error", "broken", "login problem", "technical issue", "support"])) { type = "SUPPORT"; confidence = 0.92; }
  else if (contains(text, ["placed an order", "order status", "buy now", "purchase", "delivery", "checkout"])) { type = "ORDER_REQUEST"; confidence = 0.9; }
  else if (contains(text, ["partnership", "collaborate", "reseller", "distributor", "affiliate"])) { type = "PARTNERSHIP"; confidence = 0.91; }
  else if (contains(text, ["size", "colour", "color", "material", "specification", "available in", "product question"])) { type = "PRODUCT_QUESTION"; confidence = 0.88; }
  else if (!contains(text, ["price", "quote", "demo", "interested", "want", "need", "service"])) { type = "OTHER"; confidence = 0.55; }
  const priority: LeadPriority = contains(text, ["emergency", "immediately", "urgent", "fraud", "safety"]) ? "URGENT" :
    type === "COMPLAINT" || contains(text, ["today", "as soon as possible", "refund"]) ? "HIGH" :
    type === "SPAM" ? "LOW" : "MEDIUM";
  const routingService = type === "SUPPORT" || type === "COMPLAINT" ? "SUPPORT" : type === "ORDER_REQUEST" ? "ORDERS" : "LEADS";
  const responseDraft = type === "SPAM" ? null : `Hello ${input.contactName}, thank you for contacting us about “${input.subject}”. We have received your request and routed it to the ${routingService.toLowerCase()} team for review. A team member will follow up shortly.`;
  return {
    type,
    priority,
    confidence,
    routingService,
    responseDraft,
    requiresApproval: Boolean(responseDraft),
    externalActionPerformed: false,
    recommendedActions: type === "SPAM" ? ["MARK_AS_SPAM"] : ["REVIEW_CLASSIFICATION", "CONFIRM_OWNER", ...(responseDraft ? ["APPROVE_RESPONSE_DRAFT"] : [])],
  };
}

const benchmarkCases: Array<{ name: string; expectedType: LeadType; expectedPriority: LeadPriority; input: LeadAgentInput }> = [
  { name: "sales quote", expectedType: "SALES", expectedPriority: "MEDIUM", input: { source: "WEBSITE", contactName: "Evaluation User", subject: "Need a price quote", message: "We are interested in your service and need a demo." } },
  { name: "product question", expectedType: "PRODUCT_QUESTION", expectedPriority: "MEDIUM", input: { source: "WHATSAPP", contactName: "Evaluation User", subject: "Material question", message: "Is this available in blue colour and what material is used?" } },
  { name: "technical support", expectedType: "SUPPORT", expectedPriority: "MEDIUM", input: { source: "EMAIL", contactName: "Evaluation User", subject: "Login problem", message: "The dashboard is not working and shows an error." } },
  { name: "urgent complaint", expectedType: "COMPLAINT", expectedPriority: "URGENT", input: { source: "WHATSAPP", contactName: "Evaluation User", subject: "Urgent complaint", message: "This charge looks like fraud. Resolve it immediately." } },
  { name: "order request", expectedType: "ORDER_REQUEST", expectedPriority: "MEDIUM", input: { source: "STORE", contactName: "Evaluation User", subject: "Purchase request", message: "I want to purchase this and arrange delivery." } },
  { name: "partnership", expectedType: "PARTNERSHIP", expectedPriority: "MEDIUM", input: { source: "REFERRAL", contactName: "Evaluation User", subject: "Distributor partnership", message: "We want to collaborate as your distributor." } },
  { name: "spam", expectedType: "SPAM", expectedPriority: "LOW", input: { source: "OTHER", contactName: "Evaluation User", subject: "Crypto giveaway", message: "Casino lottery winner and buy followers now." } },
];

export function benchmarkLeadAgent(iterations: number) {
  const results: Array<{ name: string; passed: boolean; latencyMs: number; expectedType: LeadType; actualType: LeadType }> = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const test of benchmarkCases) {
      const started = performance.now();
      const output = evaluateLead(test.input);
      const latencyMs = performance.now() - started;
      results.push({ name: test.name, passed: output.type === test.expectedType && output.priority === test.expectedPriority && !output.externalActionPerformed && (output.responseDraft === null || output.requiresApproval), latencyMs, expectedType: test.expectedType, actualType: output.type });
    }
  }
  const latencies = results.map((item) => item.latencyMs).sort((a, b) => a - b);
  const passed = results.filter((item) => item.passed).length;
  return {
    engineVersion: "lead-rules-v1",
    fixtureType: "NON_PERSISTED_EVALUATION_CASES",
    metrics: {
      cases: results.length,
      passed,
      passRate: results.length ? passed / results.length : 0,
      safetyCompliance: results.every((item) => item.passed) ? 1 : 0,
      averageLatencyMs: latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length),
      p95LatencyMs: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0,
    },
    cases: results.slice(0, benchmarkCases.length),
  };
}
