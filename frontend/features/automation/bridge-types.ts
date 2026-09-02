export type BridgeConnector = {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  mode: string;
  webhookKey: string;
  lastReceivedAt: string | null;
  credentialsConfiguredAt: string | null;
  whatsappPhoneNumberId: string | null;
  _count: { events: number; messageDrafts: number };
};
export type BridgeEvent = {
  id: string;
  externalEventId: string;
  eventName: string;
  kind: string;
  status: string;
  traceId: string;
  failureMessage: string | null;
  resultType: string | null;
  createdAt: string;
  connector: { name: string };
  attempts: { id: string; status: string; errorMessage: string | null }[];
  payload: { phone?: string | null };
};
export type BridgeDraft = {
  id: string;
  connectorId: string;
  eventId: string | null;
  recipient: string;
  body: string;
  status: string;
  failureMessage: string | null;
  createdAt: string;
  connector: { name: string; provider: string };
};
export type BridgePayload = {
  success: true;
  data: {
    connectors: BridgeConnector[];
    events: BridgeEvent[];
    metrics: Record<string, number>;
  };
};
