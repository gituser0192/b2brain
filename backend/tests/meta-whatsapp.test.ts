/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: {
    META_WHATSAPP_ENABLED: true,
    META_WHATSAPP_OUTBOUND_ENABLED: false,
    META_WHATSAPP_VERIFY_TOKEN: "verify-token-at-least-sixteen",
    META_WHATSAPP_APP_SECRET: "app-secret-at-least-sixteen",
    META_WHATSAPP_ACCESS_TOKEN: "test-access-token-at-least-twenty",
    META_WHATSAPP_PHONE_NUMBER_ID: "100000000000001",
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: "200000000000001",
    META_WHATSAPP_ALLOWED_TEST_RECIPIENTS: ["919999999999"],
    META_WHATSAPP_WEBHOOK_TIMEOUT_MS: 10000,
    META_WHATSAPP_PROVIDER_TIMEOUT_MS: 20,
    META_WHATSAPP_MAX_RETRIES: 1,
    META_GRAPH_API_VERSION: "v23.0",
  },
  connectorFindMany: vi.fn(),
  connectorFindFirst: vi.fn(),
  connectorUpdate: vi.fn(),
  membershipFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdateMany: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdate: vi.fn(),
  eventFindMany: vi.fn(),
  draftFindFirst: vi.fn(),
  draftUpdateMany: vi.fn(),
  draftUpdate: vi.fn(),
  timelineCreate: vi.fn(),
  agentProcess: vi.fn(),
}));

vi.mock("../src/config/env.js", () => ({ env: state.env }));
vi.mock("../src/config/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    integrationConnector: { findMany: state.connectorFindMany, findFirst: state.connectorFindFirst, update: state.connectorUpdate },
    organizationMembership: { findFirst: state.membershipFindFirst },
    integrationEvent: {
      create: state.eventCreate,
      updateMany: state.eventUpdateMany,
      findFirst: state.eventFindFirst,
      update: state.eventUpdate,
      findMany: state.eventFindMany,
    },
    automationMessageDraft: {
      findFirst: state.draftFindFirst,
      updateMany: state.draftUpdateMany,
      update: state.draftUpdate,
    },
    inquiryTimeline: { create: state.timelineCreate },
  },
}));
vi.mock("../src/modules/enquiry-agent/enquiry-agent.service.js", () => ({
  EnquiryAgentService: class {
    process = state.agentProcess;
  },
}));

import {
  WhatsappService,
  type MetaPayload,
} from "../src/modules/automation-bridge/whatsapp.service.js";

const connector = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  createdById: "00000000-0000-4000-8000-000000000003",
  provider: "META_WHATSAPP_CLOUD",
  status: "ACTIVE",
  mode: "MANUAL_APPROVAL",
  whatsappPhoneNumberId: "100000000000001",
};
const rawPayload = (message: Record<string, unknown>): MetaPayload => ({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: "100000000000001", display_phone_number: "+91 99999 99999" },
            whatsapp_business_account_id: "200000000000001",
            page_id: "300000000000001",
            contacts: [
              {
                profile: { name: "Meta Test Customer" },
                wa_id: "919999999999",
              },
            ],
            messages: [message],
          },
        },
      ],
    },
  ],
});
const raw = (payload: MetaPayload) => Buffer.from(JSON.stringify(payload));
const signature = (body: Buffer) =>
  `sha256=${createHmac("sha256", state.env.META_WHATSAPP_APP_SECRET).update(body).digest("hex")}`;

describe("Meta WhatsApp Cloud API Phase 1", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    state.env.META_WHATSAPP_ENABLED = true;
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = false;
    state.connectorFindMany.mockResolvedValue([connector]);
    state.connectorFindFirst.mockResolvedValue({ id: connector.id });
    state.membershipFindFirst.mockResolvedValue({
      userId: connector.createdById,
    });
    state.eventCreate.mockResolvedValue({ id: "receipt-1" });
    state.eventUpdateMany.mockResolvedValue({ count: 1 });
    state.eventUpdate.mockResolvedValue({});
    state.agentProcess.mockResolvedValue({
      duplicate: false,
      draftId: "draft-1",
      approvalRequired: true,
    });
  });

  it("verifies the Meta subscription challenge with a constant-time token comparison", () => {
    expect(
      new WhatsappService().verify(
        "",
        "subscribe",
        state.env.META_WHATSAPP_VERIFY_TOKEN,
        "challenge-1",
      ),
    ).toBe("challenge-1");
    expect(() =>
      new WhatsappService().verify(
        "",
        "subscribe",
        "wrong-token-value",
        "challenge-1",
      ),
    ).toThrow("Webhook verification failed.");
  });

  it("accepts a valid POST signature and rejects invalid or missing signatures", async () => {
    const payload = rawPayload({
        id: "wamid.1",
        from: "919999999999",
        type: "text",
        text: { body: "Hello" },
        timestamp: "1787940000",
      }),
      body = raw(payload);
    await expect(
      new WhatsappService().receive("", body, signature(body), payload),
    ).resolves.toMatchObject({ accepted: 1 });
    await expect(
      new WhatsappService().receive("", body, "sha256=bad", payload),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(
      new WhatsappService().receive("", body, undefined, payload),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(
      new WhatsappService().receive("", Buffer.concat([body, Buffer.from(" ")]), signature(body), payload),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(
      new WhatsappService().receive("", body, `${signature(body)}00`, payload),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
  });

  it("maps the configured Phone Number ID to one active organization-owned connector", async () => {
    const payload = rawPayload({
        id: "wamid.2",
        from: "919999999999",
        type: "text",
        text: { body: "Need admission" },
      }),
      body = raw(payload);
    await new WhatsappService().receive("", body, signature(body), payload);
    expect(state.connectorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          whatsappPhoneNumberId: "100000000000001",
          organization: { status: "ACTIVE", deletedAt: null },
        }),
      }),
    );
    expect(state.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: connector.organizationId,
        }),
      }),
    );
    const lookup = state.connectorFindMany.mock.calls[0]?.[0];
    expect(JSON.stringify(lookup)).not.toContain("919999999999");
    expect(JSON.stringify(lookup)).not.toContain("200000000000001");
    expect(JSON.stringify(lookup)).not.toContain("300000000000001");
  });

  it("rejects unknown, ambiguous, or suspended-organization connector resolution", async () => {
    state.connectorFindMany.mockResolvedValue([]);
    const payload = rawPayload({
        id: "wamid.3",
        from: "919999999999",
        type: "text",
        text: { body: "Hello" },
      }),
      body = raw(payload);
    await expect(
      new WhatsappService().receive("", body, signature(body), payload),
    ).rejects.toMatchObject({ code: "META_CONNECTOR_NOT_FOUND" });
    state.connectorFindMany.mockResolvedValue([
      connector,
      { ...connector, id: crypto.randomUUID(), organizationId: crypto.randomUUID() },
    ]);
    await expect(
      new WhatsappService().receive("", body, signature(body), payload),
    ).rejects.toMatchObject({ code: "META_CONNECTOR_NOT_FOUND" });
  });

  it("normalizes inbound text into the existing channel-independent agent contract", async () => {
    const payload = rawPayload({
        id: "wamid.4",
        from: "+91 99999-99999",
        type: "text",
        text: { body: "What are your fees?" },
        timestamp: "1787940000",
      }),
      body = raw(payload);
    state.eventFindFirst.mockResolvedValue({
      id: "receipt-1",
      organizationId: connector.organizationId,
      connectorId: connector.id,
      connector,
      attemptCount: 0,
      payload: {
        receiptKind: "MESSAGE",
        metaMessageId: "wamid.4",
        from: "919999999999",
        contactName: "Meta Test Customer",
        messageType: "text",
        message: "What are your fees?",
        receivedAt: new Date(1787940000 * 1000).toISOString(),
      },
    });
    await new WhatsappService().receive("", body, signature(body), payload);
    expect(state.agentProcess).toHaveBeenCalledWith(
      connector.organizationId,
      connector.createdById,
      expect.objectContaining({
        channel: "WHATSAPP",
        externalMessageId: "wamid.4",
        phone: "919999999999",
        message: "What are your fees?",
      }),
      expect.objectContaining({
        connectorId: connector.id,
        source: "META",
        forceApproval: true,
      }),
    );
  });

  it("records unsupported media without downloading or creating an enquiry", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    state.eventFindFirst.mockResolvedValue({
      id: "receipt-1",
      organizationId: connector.organizationId,
      connectorId: connector.id,
      connector,
      attemptCount: 0,
      payload: {
        receiptKind: "MESSAGE",
        metaMessageId: "wamid.media",
        from: "919999999999",
        messageType: "image",
        message: null,
        receivedAt: new Date().toISOString(),
      },
    });
    await new WhatsappService().processReceipt("receipt-1");
    expect(state.agentProcess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "receipt-1" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    }));
  });

  it("does not process duplicate receipt rows twice", async () => {
    // The receipt row is unique by connector and external event ID; only one worker can claim it.
    state.eventUpdateMany.mockResolvedValue({ count: 0 });
    await new WhatsappService().processReceipt("receipt-1");
    expect(state.agentProcess).not.toHaveBeenCalled();
  });

  it("updates sent, delivered, read, and failed delivery statuses by Meta message ID", async () => {
    for (const status of ["sent", "delivered", "read", "failed"]) {
      vi.clearAllMocks();
      state.eventUpdateMany.mockResolvedValue({ count: 1 });
      state.connectorFindMany.mockResolvedValue([connector]);
      state.membershipFindFirst.mockResolvedValue({
        userId: connector.createdById,
      });
      state.eventUpdate.mockResolvedValue({});
      state.eventFindFirst.mockResolvedValue({
        id: `receipt-${status}`,
        organizationId: connector.organizationId,
        connectorId: connector.id,
        connector,
        attemptCount: 0,
        payload: {
          receiptKind: "STATUS",
          metaMessageId: "wamid.outbound",
          status,
          errorCode: status === "failed" ? 131000 : null,
        },
      });
      await new WhatsappService().processReceipt(`receipt-${status}`);
      expect(state.agentProcess).not.toHaveBeenCalled();
      expect(state.draftUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: connector.organizationId,
            externalMessageId: "wamid.outbound",
          }),
          data: expect.objectContaining({
            providerStatus: status.toUpperCase(),
          }),
        }),
      );
    }
  });

  it("cannot configure a Phone Number ID on a non-WhatsApp connector", async () => {
    state.connectorFindFirst.mockResolvedValue(null);
    await expect(new WhatsappService().credentials(
      connector.organizationId,
      connector.createdById,
      connector.id,
      { phoneNumberId: "100000000000001", businessAccountId: "200000000000001", accessToken: "synthetic-token-value-long-enough", appSecret: "synthetic-secret" },
    )).rejects.toMatchObject({ code: "CONNECTOR_NOT_FOUND" });
    expect(state.connectorUpdate).not.toHaveBeenCalled();
  });

  it("preserves approval and human-takeover outcomes by never auto-sending them", async () => {
    state.eventFindFirst.mockResolvedValue({
      id: "receipt-approval",
      organizationId: connector.organizationId,
      connectorId: connector.id,
      connector,
      attemptCount: 0,
      payload: {
        receiptKind: "MESSAGE",
        metaMessageId: "wamid.approval",
        from: "919999999999",
        messageType: "text",
        message: "Refund me",
        receivedAt: new Date().toISOString(),
      },
    });
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = true;
    state.agentProcess.mockResolvedValue({
      duplicate: false,
      draftId: "draft-approval",
      approvalRequired: true,
      humanTakeover: true,
    });
    await new WhatsappService().processReceipt("receipt-approval");
    expect(state.draftFindFirst).not.toHaveBeenCalled();
  });

  it("enforces inbound and outbound kill switches", async () => {
    const payload = rawPayload({
        id: "wamid.off",
        from: "919999999999",
        type: "text",
        text: { body: "Hello" },
      }),
      body = raw(payload);
    state.env.META_WHATSAPP_ENABLED = false;
    await expect(
      new WhatsappService().receive("", body, signature(body), payload),
    ).rejects.toMatchObject({ code: "META_WHATSAPP_DISABLED" });
    state.env.META_WHATSAPP_ENABLED = true;
    await expect(
      new WhatsappService().sendApproved(
        connector.organizationId,
        connector.createdById,
        "draft-1",
      ),
    ).rejects.toMatchObject({ code: "META_OUTBOUND_DISABLED" });
  });

  it("restricts outbound delivery to explicitly configured test recipients", async () => {
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = true;
    state.draftFindFirst.mockResolvedValue({
      id: "draft-1",
      organizationId: connector.organizationId,
      status: "APPROVED",
      recipient: "918888888888",
      body: "Approved reply",
      sourceType: "ENQUIRY_AGENT",
      providerStatus: "META_PENDING_SEND",
      externalMessageId: null,
      connector,
    });
    await expect(
      new WhatsappService().sendApproved(
        connector.organizationId,
        connector.createdById,
        "draft-1",
      ),
    ).rejects.toMatchObject({ code: "META_TEST_RECIPIENT_REQUIRED" });
    expect(state.draftUpdateMany).not.toHaveBeenCalled();
  });

  it("sends an approved reply once and records the Meta message ID", async () => {
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = true;
    state.draftFindFirst.mockResolvedValue({
      id: "draft-1",
      organizationId: connector.organizationId,
      status: "APPROVED",
      recipient: "919999999999",
      body: "Approved reply",
      sourceType: "ENQUIRY_AGENT",
      providerStatus: "META_PENDING_SEND",
      externalMessageId: null,
      eventId: null,
      connector,
    });
    state.draftUpdateMany.mockResolvedValue({ count: 1 });
    state.draftUpdate.mockResolvedValue({
      id: "draft-1",
      status: "SENT",
      externalMessageId: "wamid.sent",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.sent" }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new WhatsappService().sendApproved(
        connector.organizationId,
        connector.createdById,
        "draft-1",
      ),
    ).resolves.toMatchObject({
      status: "SENT",
      externalMessageId: "wamid.sent",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(state.draftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalMessageId: "wamid.sent",
          providerStatus: "SENT",
        }),
      }),
    );
  });

  it("prevents a duplicate outbound response with an atomic draft claim", async () => {
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = true;
    state.draftFindFirst.mockResolvedValue({
      id: "draft-1",
      organizationId: connector.organizationId,
      status: "APPROVED",
      recipient: "919999999999",
      body: "Approved reply",
      sourceType: "ENQUIRY_AGENT",
      providerStatus: "META_PENDING_SEND",
      externalMessageId: null,
      connector,
    });
    state.draftUpdateMany.mockResolvedValue({ count: 0 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new WhatsappService().sendApproved(
        connector.organizationId,
        connector.createdById,
        "draft-1",
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_DELIVERY" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries transient Meta rate limits but not permanent validation failures", async () => {
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = true;
    state.draftFindFirst.mockResolvedValue({
      id: "draft-1",
      organizationId: connector.organizationId,
      status: "APPROVED",
      recipient: "919999999999",
      body: "Approved reply",
      sourceType: "ENQUIRY_AGENT",
      providerStatus: "META_PENDING_SEND",
      externalMessageId: null,
      eventId: null,
      connector,
    });
    state.draftUpdateMany.mockResolvedValue({ count: 1 });
    state.draftUpdate.mockResolvedValue({
      id: "draft-1",
      status: "SENT",
      externalMessageId: "wamid.retry",
    });
    const retrying = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "wamid.retry" }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", retrying);
    await new WhatsappService().sendApproved(
      connector.organizationId,
      connector.createdById,
      "draft-1",
    );
    expect(retrying).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    state.env.META_WHATSAPP_OUTBOUND_ENABLED = true;
    state.draftFindFirst.mockResolvedValue({
      id: "draft-2",
      organizationId: connector.organizationId,
      status: "APPROVED",
      recipient: "919999999999",
      body: "Approved reply",
      sourceType: "ENQUIRY_AGENT",
      providerStatus: "META_PENDING_SEND",
      externalMessageId: null,
      eventId: null,
      connector,
    });
    state.draftUpdateMany.mockResolvedValue({ count: 1 });
    state.draftUpdate.mockResolvedValue({});
    const permanent = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", permanent);
    await expect(
      new WhatsappService().sendApproved(
        connector.organizationId,
        connector.createdById,
        "draft-2",
      ),
    ).rejects.toMatchObject({ code: "WHATSAPP_SEND_FAILED" });
    expect(permanent).toHaveBeenCalledOnce();
  });
});
