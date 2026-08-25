import type { Prisma } from "@prisma/client";

interface SettlementInput { organizationId: string; actorUserId: string; invoiceId: string; customerId: string; invoiceNumber: string; currency: string; remaining: number; paymentId: string; }

export async function synchronizeInvoiceSettlement(tx: Prisma.TransactionClient, input: SettlementInput) {
  const now = new Date(), fullyPaid = input.remaining <= 0.001;
  const followUps = await tx.customerFollowUp.findMany({ where: { organizationId: input.organizationId, invoiceId: input.invoiceId, deletedAt: null, status: "PENDING" }, select: { id: true } });
  if (followUps.length) await tx.customerFollowUp.updateMany({ where: { organizationId: input.organizationId, id: { in: followUps.map((item) => item.id) }, status: "PENDING", deletedAt: null }, data: fullyPaid ? { status: "COMPLETED", completedAt: now, description: `Automatically completed after invoice ${input.invoiceNumber} was paid in full.`, updatedById: input.actorUserId } : { description: `Payment received. ${input.currency} ${input.remaining.toFixed(2)} remains outstanding on invoice ${input.invoiceNumber}.`, updatedById: input.actorUserId } });
  const approvals = await tx.approvalRequest.findMany({ where: { organizationId: input.organizationId, sourceType: "COLLECTION_AGENT_RUN", context: { path: ["invoiceId"], equals: input.invoiceId } }, select: { id: true, sourceId: true, status: true, context: true } });
  const pending = approvals.filter((item) => item.status === "PENDING");
  if (fullyPaid) {
    if (pending.length) await tx.approvalRequest.updateMany({ where: { organizationId: input.organizationId, id: { in: pending.map((item) => item.id) }, status: "PENDING" }, data: { status: "CANCELED", decisionNote: "Canceled automatically because the invoice was paid in full.", decidedAt: now } });
    const runIds = approvals.map((item) => item.sourceId);
    if (runIds.length) await tx.agentRun.updateMany({ where: { organizationId: input.organizationId, id: { in: runIds }, status: { in: ["QUEUED", "RUNNING", "AWAITING_APPROVAL"] } }, data: { status: "CANCELED", completedAt: now, summary: `${input.invoiceNumber} was paid in full; collection activity stopped automatically.` } });
    for (const approval of approvals) {
      const context = (approval.context ?? {}) as Record<string, unknown>;
      await tx.approvalRequest.update({ where: { id: approval.id }, data: { context: { ...context, collectionState: "SETTLED", paymentId: input.paymentId, paymentStatusChanged: true, settlementAt: now.toISOString() } } });
    }
  }
  await tx.customerActivity.create({ data: { organizationId: input.organizationId, customerId: input.customerId, type: "NOTE", summary: fullyPaid ? `Invoice ${input.invoiceNumber} paid in full.` : `Partial payment recorded for ${input.invoiceNumber}.`, details: fullyPaid ? "Linked collection follow-ups and pending reminders were closed automatically." : `${input.currency} ${input.remaining.toFixed(2)} remains outstanding.`, createdById: input.actorUserId, updatedById: input.actorUserId } });
  const owner = await tx.organizationMembership.findFirst({ where: { organizationId: input.organizationId, status: "ACTIVE", role: { code: "ORGANIZATION_OWNER" } }, select: { userId: true } });
  if (owner) await tx.notification.create({ data: { organizationId: input.organizationId, recipientId: owner.userId, type: "SYSTEM", title: fullyPaid ? "Invoice paid" : "Partial payment received", message: fullyPaid ? `${input.invoiceNumber} is fully paid. Collection activity has been closed.` : `${input.invoiceNumber} now has ${input.currency} ${input.remaining.toFixed(2)} outstanding.`, sourceType: "INVOICE", sourceId: input.invoiceId, actionPath: "/dashboard?view=finance", createdById: input.actorUserId, updatedById: input.actorUserId } });
  await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorType: "SYSTEM", actorUserId: input.actorUserId, serviceCode: "FINANCE", actionCode: fullyPaid ? "COLLECTION_CLOSED_AFTER_PAYMENT" : "COLLECTION_BALANCE_UPDATED", sourceType: "INVOICE", sourceId: input.invoiceId, summary: fullyPaid ? `Collection workflow closed automatically for paid invoice ${input.invoiceNumber}.` : `Collection balance updated after partial payment on ${input.invoiceNumber}.`, metadata: { paymentId: input.paymentId, remaining: input.remaining, followUpCount: followUps.length, pendingReminderCount: pending.length } } });
  return { fullyPaid, followUpsUpdated: followUps.length, remindersCanceled: fullyPaid ? pending.length : 0 };
}
