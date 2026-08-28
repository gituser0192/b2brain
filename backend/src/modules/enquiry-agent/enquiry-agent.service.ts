import { createHash, randomBytes } from "node:crypto";
import { Prisma, type InquiryType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { DeterministicEnquiryAgentProvider, type EnquiryAgentProvider } from "./enquiry-agent.provider.js";
import type { AgentDraftDecision, HumanTakeoverInput, NormalizedInboundMessage } from "./enquiry-agent.validation.js";

type InternalConfiguration = { humanTakeoverConversationIds?: string[]; humanTakeoverInquiryIds?: string[]; simulator?: boolean };
const inquiryType: Record<string, InquiryType> = { SALES_ENQUIRY: "SALES", SERVICE_PRICING: "PRODUCT_QUESTION", CUSTOMER_REQUIREMENT: "SALES", FOLLOW_UP_REQUEST: "SALES", SUPPORT_REQUEST: "SUPPORT", COMPLAINT: "COMPLAINT", REFUND_PAYMENT: "SUPPORT", SPAM: "SPAM", UNKNOWN: "UNCLASSIFIED", GREETING: "UNCLASSIFIED" };
export const inquiryTypeForAgentIntent = (intent: string): InquiryType => inquiryType[intent] ?? "UNCLASSIFIED";
const humanOnly = new Set(["REFUND_PAYMENT"]);
const approvalRequired = new Set(["SERVICE_PRICING", "COMPLAINT", "UNKNOWN"]);
const requiresFollowUp = new Set(["CUSTOMER_REQUIREMENT", "FOLLOW_UP_REQUEST", "SUPPORT_REQUEST", "COMPLAINT", "REFUND_PAYMENT", "UNKNOWN"]);
export function enforceAgentPolicy(intent: string, confidence: number, promptInjectionDetected: boolean) {
  const missingKnowledge = intent === "SERVICE_PRICING";
  const humanOnlyAction = humanOnly.has(intent);
  const unsafe = humanOnlyAction || promptInjectionDetected || confidence < 0.65;
  return { missingKnowledge, humanOnlyAction, unsafe, needsApproval: !unsafe && (approvalRequired.has(intent) || missingKnowledge), followUpRequired: requiresFollowUp.has(intent) || unsafe };
}
const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");

export class EnquiryAgentService {
  constructor(private readonly provider: EnquiryAgentProvider = new DeterministicEnquiryAgentProvider()) {}
  private async connector(organizationId: string, userId: string, connectorId?: string) {
    if (connectorId) {
      const selected = await prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId, type: "WHATSAPP", status: "ACTIVE", deletedAt: null } });
      if (!selected) throw new AppError(404, "Active WhatsApp connector was not found.", "CONNECTOR_NOT_FOUND");
      const configuration = selected.configuration as InternalConfiguration;
      if (!configuration.simulator && selected.provider.toUpperCase() !== "B2BRAIN_SIMULATOR") throw new AppError(409, "This endpoint only accepts simulator connectors.", "SIMULATOR_CONNECTOR_REQUIRED");
      return selected;
    }
    const existing = await prisma.integrationConnector.findFirst({ where: { organizationId, provider: "B2BRAIN_AGENT_PLAYGROUND", deletedAt: null } });
    if (existing) return existing;
    const secret = randomBytes(24).toString("hex");
    return prisma.integrationConnector.create({ data: { organizationId, name: "Internal Agent Playground", type: "WEBSITE", status: "ACTIVE", mode: "ASSISTED", provider: "B2BRAIN_AGENT_PLAYGROUND", configuration: {}, signingSecretHash: createHash("sha256").update(secret).digest("hex"), createdById: userId, updatedById: userId } });
  }
  async process(organizationId: string, userId: string, input: NormalizedInboundMessage, options: { connectorId?: string } = {}) {
    const connector = await this.connector(organizationId, userId, options.connectorId);
    const duplicate = await prisma.integrationEvent.findFirst({ where: { organizationId, connectorId: connector.id, externalEventId: input.externalMessageId }, select: { id: true, resultId: true, status: true, payload: true } });
    if (duplicate) return { duplicate: true, eventId: duplicate.id, inquiryId: duplicate.resultId, status: duplicate.status };
    let analysis;
    try { analysis = await this.provider.analyze(input.message); }
    catch { throw new AppError(503, "The enquiry agent is temporarily unavailable. Retry with the same message ID.", "AGENT_PROVIDER_UNAVAILABLE"); }
    const configuration = connector.configuration as InternalConfiguration;
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const [organization, customers, openInquiries, owner] = await Promise.all([
      prisma.organization.findFirst({ where: { id: organizationId, status: "ACTIVE", deletedAt: null }, select: { id: true, name: true } }),
      phone ? prisma.customer.findMany({ where: { organizationId, phone: { not: null }, deletedAt: null }, select: { id: true, phone: true, displayName: true } }) : [],
      phone ? prisma.inquiry.findMany({ where: { organizationId, phone: { not: null }, deletedAt: null, status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] } }, select: { id: true, phone: true, assignedEmployee: { select: { linkedUserId: true } } }, orderBy: { updatedAt: "desc" } }) : [],
      prisma.organizationMembership.findFirst({ where: { organizationId, status: "ACTIVE", role: { code: "ORGANIZATION_OWNER" }, user: { status: "ACTIVE", deletedAt: null } }, select: { userId: true } }),
    ]);
    if (!organization || !owner) throw new AppError(403, "The active organization context is unavailable.", "ORGANIZATION_INACTIVE");
    const customer = customers.find((item) => item.phone && normalizePhone(item.phone) === phone);
    const existingInquiry = openInquiries.find((item) => item.phone && normalizePhone(item.phone) === phone);
    const takeover = (configuration.humanTakeoverConversationIds ?? []).includes(input.conversationId) || Boolean(existingInquiry && (configuration.humanTakeoverInquiryIds ?? []).includes(existingInquiry.id));
    const policy = enforceAgentPolicy(analysis.intent, analysis.confidence, analysis.promptInjectionDetected);
    const { missingKnowledge, unsafe, needsApproval } = policy;
    const sources = analysis.intent === "GREETING" ? ["organization.approved_public_identity"] : [];
    const response = unsafe ? "I cannot complete this request automatically. A human team member has been notified." : missingKnowledge ? "I need confirmation from the business team before providing pricing, availability, discounts or commitments." : analysis.intent === "GREETING" ? `Hello! You are speaking with ${organization.name}. How can we help you today?` : analysis.intent === "SALES_ENQUIRY" ? `Thank you for contacting ${organization.name}. Please share your requirement and the business team will confirm the suitable services.` : `Thank you for contacting ${organization.name}. Your ${analysis.intent.toLowerCase().replaceAll("_", " ")} has been recorded for review.`;
    const actor = existingInquiry?.assignedEmployee?.linkedUserId ?? owner.userId;
    const payload = { channel: input.channel, conversationId: input.conversationId, customerName: input.customerName, phone, message: input.message, receivedAt: input.receivedAt ?? new Date().toISOString(), metadata: input.metadata, analysis, provider: this.provider.name };
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return prisma.$transaction(async (tx) => {
      const crmCustomer = customer ?? (phone ? await tx.customer.create({ data: { organizationId, type: "PERSON", displayName: input.customerName ?? phone, ...(input.customerName ? { firstName: input.customerName } : {}), phone, status: "LEAD", notes: "Created by Sales and Customer Enquiry Agent", createdById: userId, updatedById: userId }, select: { id: true, displayName: true } }) : null);
      const event = await tx.integrationEvent.create({ data: { organizationId, connectorId: connector.id, externalEventId: input.externalMessageId, eventName: "enquiry-agent.message.received", kind: analysis.intent === "SPAM" ? "SPAM" : analysis.intent === "COMPLAINT" ? "COMPLAINT" : analysis.intent === "REFUND_PAYMENT" || analysis.intent === "SUPPORT_REQUEST" ? "SUPPORT_REQUEST" : "INQUIRY", status: "COMPLETED", signatureVerified: true, payload: payload as Prisma.InputJsonValue, payloadHash, attemptCount: 1, processedAt: new Date(), createdById: userId, updatedById: userId } });
      const inquiry = existingInquiry ? await tx.inquiry.update({ where: { id: existingInquiry.id }, data: { ...(crmCustomer ? { customerId: crmCustomer.id } : {}), type: inquiryType[analysis.intent] ?? "UNCLASSIFIED", message: input.message, status: analysis.intent === "SPAM" ? "SPAM" : "REVIEWING", updatedById: userId } }) : await tx.inquiry.create({ data: { organizationId, customerId: crmCustomer?.id ?? null, source: input.channel === "WHATSAPP" ? "WHATSAPP" : "WEBSITE", type: inquiryType[analysis.intent] ?? "UNCLASSIFIED", status: analysis.intent === "SPAM" ? "SPAM" : "NEW", priority: unsafe || analysis.intent === "COMPLAINT" ? "HIGH" : "MEDIUM", contactName: input.customerName ?? phone ?? "Website visitor", phone, subject: `Agent: ${analysis.intent.replaceAll("_", " ")}`, message: input.message, nextFollowUpAt: requiresFollowUp.has(analysis.intent) || unsafe ? new Date(Date.now() + 60 * 60_000) : null, followUpNote: unsafe ? "Human-only or unclear request." : null, createdById: userId, updatedById: userId } });
      await tx.integrationEvent.update({ where: { id: event.id }, data: { resultType: "INQUIRY", resultId: inquiry.id } });
      await tx.inquiryTimeline.create({ data: { organizationId, inquiryId: inquiry.id, type: "CLASSIFIED", summary: `${analysis.intent} (${Math.round(analysis.confidence * 100)}% confidence)`, details: input.message, createdById: userId } });
      if (crmCustomer) await tx.customerActivity.create({ data: { organizationId, customerId: crmCustomer.id, type: input.channel === "WHATSAPP" ? "WHATSAPP" : "NOTE", summary: `Inbound ${input.channel.toLowerCase().replaceAll("_", " ")} message`, details: input.message, createdById: userId, updatedById: userId } });
      const tools = [customer ? "find_customer" : crmCustomer ? "create_customer" : "find_customer", "add_customer_activity", existingInquiry ? "create_or_update_enquiry:update" : "create_or_update_enquiry:create", ...(sources.length ? ["search_approved_business_knowledge"] : []), ...(policy.followUpRequired ? ["create_follow_up", "request_human_takeover"] : [])];
      if (crmCustomer && policy.followUpRequired) await tx.customerFollowUp.create({ data: { organizationId, customerId: crmCustomer.id, title: `Agent handoff: ${analysis.intent.replaceAll("_", " ")}`, description: input.message, dueAt: new Date(Date.now() + 60 * 60_000), assignedToId: actor, createdById: userId, updatedById: userId } });
      let draftId: string | null = null, approvalId: string | null = null;
      if (analysis.intent !== "SPAM" && !takeover) {
        const draft = await tx.automationMessageDraft.create({ data: { organizationId, connectorId: connector.id, eventId: event.id, recipient: phone ?? `conversation:${input.conversationId}`, body: response, sourceType: "ENQUIRY_AGENT", sourceId: inquiry.id, status: needsApproval || unsafe ? "PENDING_APPROVAL" : "APPROVED", providerStatus: options.connectorId ? "SIMULATED_NOT_SENDABLE" : "INTERNAL_PLAYGROUND_ONLY", createdById: userId, updatedById: userId } });
        draftId = draft.id;
        if (needsApproval || unsafe) { const approval = await tx.approvalRequest.create({ data: { organizationId, serviceCode: "AUTOMATION", actionCode: "ENQUIRY_AGENT_RESPONSE", title: `Review agent response: ${analysis.intent.replaceAll("_", " ")}`, description: response, riskLevel: unsafe ? "HIGH" : "MEDIUM", sourceType: "ENQUIRY_AGENT_DRAFT", sourceId: draft.id, requestedById: userId, context: { conversationId: input.conversationId, inquiryId: inquiry.id, intent: analysis.intent, humanOnly: humanOnly.has(analysis.intent), externalDeliveryPerformed: false } } }); approvalId = approval.id; }
      }
      if (policy.followUpRequired || needsApproval) await tx.notification.upsert({ where: { organizationId_recipientId_sourceType_sourceId: { organizationId, recipientId: actor, sourceType: "ENQUIRY_AGENT", sourceId: inquiry.id } }, update: { title: `Agent review: ${analysis.intent}`, message: input.message, readAt: null, deletedAt: null, updatedById: userId }, create: { organizationId, recipientId: actor, type: needsApproval || unsafe ? "APPROVAL_REQUIRED" : "FOLLOW_UP_DUE", title: `Agent review: ${analysis.intent}`, message: input.message, sourceType: "ENQUIRY_AGENT", sourceId: inquiry.id, actionPath: "/dashboard?view=agent-playground", createdById: userId, updatedById: userId } });
      await tx.auditEvent.create({ data: { organizationId, actorType: "AI_AGENT", actorUserId: userId, serviceCode: "AUTOMATION", actionCode: "ENQUIRY_MESSAGE_PROCESSED", sourceType: "INTEGRATION_EVENT", sourceId: event.id, summary: `${analysis.intent} processed by ${this.provider.name}.`, metadata: { tools, productionModel: this.provider.productionModel, promptInjectionDetected: analysis.promptInjectionDetected, externalActionPerformed: false } } });
      await tx.integrationConnector.update({ where: { id: connector.id }, data: { lastReceivedAt: new Date(), lastSuccessfulAt: new Date(), updatedById: userId } });
      return { duplicate: false, eventId: event.id, conversationId: input.conversationId, customer: crmCustomer, customerCreated: Boolean(crmCustomer && !customer), inquiryId: inquiry.id, analysis, response, knowledgeSources: sources, tools, draftId, approvalId, approvalRequired: Boolean(approvalId), humanTakeover: takeover || unsafe, provider: { name: this.provider.name, productionModel: this.provider.productionModel }, externalActionPerformed: false };
    });
  }
  async history(organizationId: string, conversationId: string) {
    const connector = await prisma.integrationConnector.findFirst({ where: { organizationId, provider: "B2BRAIN_AGENT_PLAYGROUND", deletedAt: null }, select: { id: true, configuration: true } });
    if (!connector) return { messages: [], humanTakeover: false };
    const events = await prisma.integrationEvent.findMany({ where: { organizationId, connectorId: connector.id }, include: { messageDrafts: true }, orderBy: { createdAt: "desc" }, take: 200 });
    const matches = events.filter((event) => (event.payload as { conversationId?: string }).conversationId === conversationId).reverse();
    const configuration = connector.configuration as InternalConfiguration;
    return { humanTakeover: (configuration.humanTakeoverConversationIds ?? []).includes(conversationId), messages: matches.map((event) => { const payload = event.payload as { message?: string; analysis?: unknown; provider?: string }; const draft = event.messageDrafts[0]; return { eventId: event.id, externalMessageId: event.externalEventId, customerMessage: payload.message, analysis: payload.analysis, provider: payload.provider, response: draft?.body ?? null, draftId: draft?.id ?? null, draftStatus: draft?.status ?? null, createdAt: event.createdAt }; }) };
  }
  async decideDraft(organizationId: string, userId: string, id: string, input: AgentDraftDecision) {
    const draft = await prisma.automationMessageDraft.findFirst({ where: { id, organizationId, sourceType: "ENQUIRY_AGENT", status: "PENDING_APPROVAL" } });
    if (!draft) throw new AppError(404, "Pending agent draft was not found.", "DRAFT_NOT_FOUND");
    const approval = await prisma.approvalRequest.findFirst({ where: { organizationId, sourceType: "ENQUIRY_AGENT_DRAFT", sourceId: id, status: "PENDING" }, select: { requestedById: true } });
    if (!approval) throw new AppError(404, "Pending agent approval was not found.", "APPROVAL_NOT_FOUND");
    if (approval.requestedById === userId) throw new AppError(403, "Another authorized user must decide this agent response.", "SEPARATION_OF_DUTIES_REQUIRED");
    return prisma.$transaction(async (tx) => {
      const status = input.decision === "APPROVE" ? "APPROVED" : "CANCELED";
      const updated = await tx.automationMessageDraft.update({ where: { id }, data: { body: input.editedBody ?? draft.body, status, approvedById: input.decision === "APPROVE" ? userId : null, approvedAt: input.decision === "APPROVE" ? new Date() : null, failureMessage: input.decision === "REJECT" ? input.note : null, updatedById: userId } });
      await tx.approvalRequest.updateMany({ where: { organizationId, sourceType: "ENQUIRY_AGENT_DRAFT", sourceId: id, status: "PENDING" }, data: { status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedById: userId, decisionNote: input.note, decidedAt: new Date() } });
      return updated;
    });
  }
  async takeover(organizationId: string, userId: string, input: HumanTakeoverInput) {
    const connector = await this.connector(organizationId, userId), configuration = connector.configuration as InternalConfiguration, ids = new Set(configuration.humanTakeoverConversationIds ?? []);
    if (input.enabled) ids.add(input.conversationId); else ids.delete(input.conversationId);
    await prisma.integrationConnector.update({ where: { id: connector.id }, data: { configuration: { ...configuration, humanTakeoverConversationIds: [...ids] }, updatedById: userId } });
    return { conversationId: input.conversationId, humanTakeover: input.enabled };
  }
}
