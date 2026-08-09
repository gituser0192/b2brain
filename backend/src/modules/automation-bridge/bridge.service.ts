import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  ConnectorInput,
  EventDecisionInput,
  IntakeInput,
} from "./bridge.validation.js";
const connectorView={id:true,name:true,type:true,status:true,mode:true,provider:true,externalAccountRef:true,webhookKey:true,whatsappPhoneNumberId:true,whatsappBusinessAccountId:true,credentialsConfiguredAt:true,lastReceivedAt:true,lastSuccessfulAt:true,lastErrorAt:true,lastErrorMessage:true,createdAt:true,_count:{select:{events:true,messageDrafts:true}}}as const;
const eventInclude = {
  connector: { select: { id: true, name: true, type: true, mode: true } },
  attempts: { orderBy: { createdAt: "desc" as const } },
};
export class BridgeService {
  async list(org: string) {
    const [connectors, events] = await Promise.all([
      prisma.integrationConnector.findMany({
        where: { organizationId: org, deletedAt: null },
        select: connectorView,
        orderBy: { createdAt: "desc" },
      }),
      prisma.integrationEvent.findMany({
        where: { organizationId: org },
        include: eventInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);
    return {
      connectors,
      events,
      metrics: {
        received: events.length,
        awaitingApproval: events.filter((e) => e.status === "AWAITING_APPROVAL")
          .length,
        completed: events.filter((e) => e.status === "COMPLETED").length,
        failed: events.filter((e) => e.status === "FAILED").length,
        quarantined: events.filter((e) => e.status === "QUARANTINED").length,
      },
    };
  }
  async createConnector(org: string, user: string, input: ConnectorInput) {
    const secret = randomBytes(24).toString("hex"),
      signingSecretHash = createHash("sha256").update(secret).digest("hex");
    const connector = await prisma.integrationConnector.create({
      data: {
        ...input,
        organizationId: org,
        configuration: {},
        signingSecretHash,
        createdById: user,
        updatedById: user,
      },
      select: connectorView,
    });
    return {
      connector,
      webhookSecret: secret,
      warning: "Store this secret securely. It is shown only once.",
    };
  }
  async updateConnector(
    org: string,
    user: string,
    id: string,
    input: ConnectorInput,
  ) {
    const current = await prisma.integrationConnector.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!current)
      throw new AppError(
        404,
        "Connector was not found.",
        "CONNECTOR_NOT_FOUND",
      );
    return prisma.integrationConnector.update({
      where: { id },
      data: { ...input, updatedById: user },
      select: connectorView,
    });
  }
  async archiveConnector(org: string, user: string, id: string) {
    if (
      (
        await prisma.integrationConnector.updateMany({
          where: { id, organizationId: org, deletedAt: null },
          data: {
            status: "ARCHIVED",
            deletedAt: new Date(),
            updatedById: user,
          },
        })
      ).count !== 1
    )
      throw new AppError(
        404,
        "Connector was not found.",
        "CONNECTOR_NOT_FOUND",
      );
  }
  private kind(input: IntakeInput) {
    if (input.kind === "SPAM") return { status: "IGNORED" as const };
    return { status: "AWAITING_APPROVAL" as const };
  }
  async intake(
    org: string,
    user: string,
    connectorId: string,
    input: IntakeInput,
  ) {
    const connector = await prisma.integrationConnector.findFirst({
      where: { id: connectorId, organizationId: org, deletedAt: null },
    });
    if (!connector)
      throw new AppError(
        404,
        "Connector was not found.",
        "CONNECTOR_NOT_FOUND",
      );
    if (connector.status !== "ACTIVE")
      throw new AppError(
        409,
        "Activate the connector before receiving events.",
        "CONNECTOR_NOT_ACTIVE",
      );
    const payload = {
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      subject: input.subject,
      message: input.message,
      raw: input.raw,
    };
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    try {
      return await prisma.$transaction(async (tx) => {
        const event = await tx.integrationEvent.create({
          data: {
            organizationId: org,
            connectorId,
            externalEventId: input.externalEventId,
            eventName: input.eventName,
            kind: input.kind,
            status: this.kind(input).status,
            signatureVerified: true,
            payload: payload as Prisma.InputJsonValue,
            payloadHash,
            attemptCount: 0,
            createdById: user,
            updatedById: user,
          },
          include: eventInclude,
        });
        await tx.integrationConnector.update({
          where: { id: connectorId },
          data: { lastReceivedAt: new Date(), updatedById: user },
        });
        return event;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "This external event was already received. No duplicate record was created.",
          "DUPLICATE_EVENT",
        );
      throw error;
    }
  }
  private async process(org: string, user: string, id: string) {
    const event = await prisma.integrationEvent.findFirst({
      where: { id, organizationId: org },
      include: { connector: true },
    });
    if (!event)
      throw new AppError(
        404,
        "Integration event was not found.",
        "EVENT_NOT_FOUND",
      );
    if (!["AWAITING_APPROVAL", "FAILED", "QUARANTINED"].includes(event.status))
      throw new AppError(
        409,
        "This event is not available for processing.",
        "EVENT_NOT_PROCESSABLE",
      );
    const payload = event.payload as {
      contactName?: string | null;
      email?: string | null;
      phone?: string | null;
      subject?: string | null;
      message?: string | null;
    };
    const matchedCustomer=await prisma.customer.findFirst({where:{organizationId:org,deletedAt:null,OR:[...(payload.email?[{email:{equals:payload.email,mode:"insensitive" as const}}]:[]),...(payload.phone?[{phone:payload.phone}]:[])]},select:{id:true}});
    const attempt = event.attemptCount + 1;
    return prisma.$transaction(async (tx) => {
      await tx.automationAttempt.create({
        data: {
          organizationId: org,
          eventId: id,
          attemptNumber: attempt,
          action: "CLASSIFY_AND_ROUTE",
          status: "RUNNING",
          input: event.payload as Prisma.InputJsonValue,
          startedAt: new Date(),
          createdById: user,
        },
      });
      try {
        let resultType = "",
          resultId: string | null = null;
        if (
          [
            "INQUIRY",
            "SUPPORT_REQUEST",
            "COMPLAINT",
            "SALES_OPPORTUNITY",
            "ORDER_REQUEST",
          ].includes(event.kind)
        ) {
          const inquiry = await tx.inquiry.create({
            data: {
              organizationId: org,
              customerId: matchedCustomer?.id ?? null,
              source:
                event.connector.type === "WHATSAPP"
                  ? "WHATSAPP"
                  : event.connector.type === "WEBSITE" ||
                      event.connector.type === "COMMERCE"
                    ? "WEBSITE"
                    : event.connector.type === "EMAIL"
                      ? "EMAIL"
                      : event.connector.type === "SOCIAL"
                        ? "SOCIAL"
                        : "OTHER",
              type:
                event.kind === "SUPPORT_REQUEST"
                  ? "SUPPORT"
                  : event.kind === "COMPLAINT"
                    ? "COMPLAINT"
                    : event.kind === "ORDER_REQUEST"
                      ? "ORDER_REQUEST"
                      : event.kind === "SALES_OPPORTUNITY"
                        ? "SALES"
                        : "UNCLASSIFIED",
              status: "NEW",
              priority: event.kind === "COMPLAINT" ? "HIGH" : "MEDIUM",
              contactName: payload.contactName!,
              email: payload.email ?? null,
              phone: payload.phone ?? null,
              subject: payload.subject!,
              message: payload.message!,
              createdById: user,
              updatedById: user,
              timeline: {
                create: {
                  organizationId: org,
                  type: "CREATED",
                  summary: `Captured by Automation Bridge from ${event.connector.name}`,
                  details: `Trace ${event.traceId}`,
                  createdById: user,
                },
              },
            },
          });
          resultType = "INQUIRY";
          resultId = inquiry.id;
        } else
          throw new AppError(
            409,
            "This event kind requires a future verified commerce or payment adapter.",
            "ADAPTER_NOT_AVAILABLE",
          );
        await tx.automationAttempt.update({
          where: {
            eventId_attemptNumber: { eventId: id, attemptNumber: attempt },
          },
          data: {
            status: "COMPLETED",
            output: { resultType, resultId },
            completedAt: new Date(),
          },
        });
        await tx.integrationConnector.update({
          where: { id: event.connectorId },
          data: {
            lastSuccessfulAt: new Date(),
            lastErrorAt: null,
            lastErrorMessage: null,
            updatedById: user,
          },
        });
        return tx.integrationEvent.update({
          where: { id },
          data: {
            status: "COMPLETED",
            attemptCount: attempt,
            processedAt: new Date(),
            quarantinedAt: null,
            failureCode: null,
            failureMessage: null,
            resultType,
            resultId,
            updatedById: user,
          },
          include: eventInclude,
        });
      } catch (error) {
        await tx.automationAttempt.update({
          where: {
            eventId_attemptNumber: { eventId: id, attemptNumber: attempt },
          },
          data: {
            status: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Processing failed",
            completedAt: new Date(),
          },
        });
        throw error;
      }
    });
  }
  async decide(
    org: string,
    user: string,
    id: string,
    input: EventDecisionInput,
  ) {
    const event = await prisma.integrationEvent.findFirst({
      where: { id, organizationId: org },
    });
    if (!event)
      throw new AppError(
        404,
        "Integration event was not found.",
        "EVENT_NOT_FOUND",
      );
    if (input.decision === "APPROVE") return this.process(org, user, id);
    const status = input.decision === "IGNORE" ? "IGNORED" : "QUARANTINED";
    return prisma.integrationEvent.update({
      where: { id },
      data: {
        status,
        quarantinedAt: status === "QUARANTINED" ? new Date() : null,
        failureMessage: input.reason,
        updatedById: user,
      },
      include: eventInclude,
    });
  }
  async retry(org: string, user: string, id: string) {
    return this.process(org, user, id);
  }
}
