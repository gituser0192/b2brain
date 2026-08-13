import { randomUUID } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { BridgeService } from "./bridge.service.js";
import type { WebsiteFormConfigInput, WebsiteLeadInput } from "./website-form.validation.js";

const defaults: WebsiteFormConfigInput = {
  title: "How can we help?",
  description: "Share your requirement and our team will contact you.",
  submitLabel: "Send inquiry",
  successMessage: "Thank you. Your inquiry has been received.",
  accentColor: "#087ce3",
  askService: true,
  serviceLabel: "Service required",
};

function configuration(value: unknown): WebsiteFormConfigInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const form = (value as Record<string, unknown>).websiteForm;
  return form && typeof form === "object" && !Array.isArray(form)
    ? { ...defaults, ...(form as Partial<WebsiteFormConfigInput>) }
    : defaults;
}

export class WebsiteFormService {
  private bridge = new BridgeService();

  private async connector(formKey: string) {
    const connector = await prisma.integrationConnector.findFirst({
      where: { webhookKey: formKey, type: "WEBSITE", status: "ACTIVE", deletedAt: null },
      select: { id: true, organizationId: true, createdById: true, name: true, mode: true, configuration: true },
    });
    if (!connector) throw new AppError(404, "This inquiry form is not available.", "FORM_NOT_FOUND");
    return connector;
  }

  async publicConfig(formKey: string) {
    const connector = await this.connector(formKey);
    return { formKey, connectorName: connector.name, ...configuration(connector.configuration) };
  }

  async updateConfig(organizationId: string, actorUserId: string, connectorId: string, input: WebsiteFormConfigInput) {
    const connector = await prisma.integrationConnector.findFirst({
      where: { id: connectorId, organizationId, type: "WEBSITE", deletedAt: null },
      select: { id: true, configuration: true, webhookKey: true },
    });
    if (!connector) throw new AppError(404, "Website connector was not found.", "CONNECTOR_NOT_FOUND");
    const current = connector.configuration && typeof connector.configuration === "object" && !Array.isArray(connector.configuration)
      ? connector.configuration as Record<string, unknown>
      : {};
    await prisma.integrationConnector.update({
      where: { id: connector.id },
      data: { configuration: { ...current, websiteForm: input }, updatedById: actorUserId },
    });
    return { formKey: connector.webhookKey, ...input };
  }

  async submit(formKey: string, input: WebsiteLeadInput) {
    const connector = await this.connector(formKey);
    if (input.website || Date.now() - input.startedAt < 1200)
      return { accepted: true };
    const service = input.service?.trim();
    const event = await this.bridge.intake(connector.organizationId, connector.createdById, connector.id, {
      externalEventId: `form-${randomUUID()}`,
      eventName: "website.form.submitted",
      kind: "INQUIRY",
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      subject: service ? `Website inquiry: ${service}` : "Website inquiry",
      message: input.message,
      raw: { service, capturedBy: "B2 Brain Website Lead Form" },
    });
    return { accepted: true, status: event.status, successMessage: configuration(connector.configuration).successMessage };
  }
}
