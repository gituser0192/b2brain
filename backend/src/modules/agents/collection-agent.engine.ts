export interface CollectionCase { total: number; paid: number; refunded: number; dueDate: Date; customerName: string; invoiceNumber: string; currency: string }
export function evaluateCollection(input: CollectionCase, now = new Date()) {
  const outstanding = Math.max(0, input.total - input.paid + input.refunded);
  const daysOverdue = Math.max(0, Math.floor((now.getTime() - input.dueDate.getTime()) / 86_400_000));
  const risk = outstanding === 0 ? "SETTLED" : daysOverdue >= 60 ? "CRITICAL" : daysOverdue >= 30 ? "HIGH" : daysOverdue >= 8 ? "MEDIUM" : "LOW";
  const channel = risk === "CRITICAL" ? "HUMAN_REVIEW" : "MESSAGE_DRAFT";
  const responseDraft = outstanding === 0 ? null : `Hello ${input.customerName}, this is a reminder that ${input.currency} ${outstanding.toFixed(2)} remains outstanding for invoice ${input.invoiceNumber}, due on ${input.dueDate.toISOString().slice(0, 10)}. Please let us know if payment has already been made or if you need assistance.`;
  return { outstanding, daysOverdue, risk, channel, responseDraft, requiresApproval: Boolean(responseDraft), externalActionPerformed: false, paymentStatusChanged: false };
}
export function benchmarkCollectionAgent(iterations: number) {
  const now = new Date("2026-08-20T00:00:00.000Z");
  const cases = [
    { expected: [0, "SETTLED"], input: { total: 1000, paid: 1000, refunded: 0, dueDate: new Date("2026-08-01"), customerName: "Evaluation", invoiceNumber: "INV-1", currency: "INR" } },
    { expected: [500, "LOW"], input: { total: 1000, paid: 500, refunded: 0, dueDate: new Date("2026-08-18"), customerName: "Evaluation", invoiceNumber: "INV-2", currency: "INR" } },
    { expected: [1000, "MEDIUM"], input: { total: 1000, paid: 0, refunded: 0, dueDate: new Date("2026-08-10"), customerName: "Evaluation", invoiceNumber: "INV-3", currency: "INR" } },
    { expected: [1100, "HIGH"], input: { total: 1000, paid: 200, refunded: 300, dueDate: new Date("2026-07-15"), customerName: "Evaluation", invoiceNumber: "INV-4", currency: "INR" } },
    { expected: [2500, "CRITICAL"], input: { total: 2500, paid: 0, refunded: 0, dueDate: new Date("2026-05-01"), customerName: "Evaluation", invoiceNumber: "INV-5", currency: "INR" } },
  ] as const;
  const latencies: number[] = []; let passed = 0;
  for (let i = 0; i < iterations; i += 1) for (const test of cases) { const start = performance.now(); const output = evaluateCollection(test.input, now); latencies.push(performance.now() - start); if (output.outstanding === test.expected[0] && output.risk === test.expected[1] && !output.externalActionPerformed && !output.paymentStatusChanged && (output.responseDraft === null || output.requiresApproval)) passed += 1; }
  latencies.sort((a, b) => a - b); const count = cases.length * iterations;
  return { engineVersion: "collection-rules-v1", fixtureType: "NON_PERSISTED_EVALUATION_CASES", metrics: { cases: count, passed, passRate: passed / count, safetyCompliance: passed / count, averageLatencyMs: latencies.reduce((a, b) => a + b, 0) / count, p95LatencyMs: latencies[Math.ceil(count * 0.95) - 1] ?? 0 } };
}
