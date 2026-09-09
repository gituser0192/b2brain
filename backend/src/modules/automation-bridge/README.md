# Automation Bridge inbound events

Phase A establishes one versioned, channel-independent boundary for inbound customer messages:

`adapter → source verification → trusted connector/organization resolution → normalization → idempotent processing → deterministic CRM workflow → approval/escalation → audit result`

## Contract and adapters

`contracts/inbound-event.contract.ts` owns strict validation, size limits, normalized sender identity and the safe result shape. `CUSTOMER_MESSAGE` is the only active event type. Other documented types are reservations, not working integrations.

An adapter authenticates its source, resolves only adapter-owned fields and submits a normalized event. It must not contain CRM writes or accept an organization ID from external JSON. The simulator obtains the organization from authenticated membership and verifies that its connector belongs to that organization. Future webhooks must instead derive organization identity from a cryptographically verified connector mapping.

## Processing and idempotency

`processing/inbound-event.processor.ts` validates channel ownership and delegates the permitted deterministic workflow to the existing Customer Enquiry Agent. The existing `IntegrationEvent` unique constraint on organization, connector and external event ID is the final concurrent-write guard. Completed duplicates return a bounded duplicate result; active processing conflicts; atomic transaction failures can be retried because CRM writes roll back together. A redacted failure audit records the correlation ID and a hash—not the external identifier or message body.

The processor can find/create a lead, record activity, create/update an inquiry, create a follow-up, notify staff and prepare an approval-controlled reply draft. It cannot send messages, take payments, issue refunds, apply discounts, confirm orders, delete records or execute arbitrary tools.

## Adding a future adapter

1. Verify the provider signature before normalization.
2. Resolve the connector without trusting payload tenant identifiers.
3. Map only bounded, non-secret fields into contract version 1.
4. Call the shared processor; never duplicate CRM orchestration.
5. Add isolation, replay, malformed-payload and provider-failure tests.

Commerce, Meta Lead Ads and WhatsApp Cloud API adapters remain inactive. The WhatsApp UI is still a simulator and performs no external delivery. Hosted AI is not required by this ingestion path.

## Website enquiry adapter (Phase B)

Phase B is a server-to-server integration. Browser code must not contain the connector secret. An authorized Automation manager creates an active `WEBSITE` connector through the existing connector API. The response includes the connector `webhookKey` (the public identifier) and a signing secret exactly once. Rotate that secret with `POST /api/v1/automation-bridge/connectors/:id/website-secret/rotate`; the old secret stops working immediately.

Send JSON to `POST /api/v1/integrations/website/enquiries/:connectorPublicId` with these headers:

- `Content-Type: application/json`
- `x-b2brain-timestamp`: current Unix time in seconds
- `x-b2brain-event-id`: the same unique value used in the payload's `eventId`
- `x-b2brain-signature`: `v1=` followed by the lowercase HMAC-SHA256 hex digest

The signed bytes are exactly `timestamp + "." + eventId + "." + rawRequestBody`. Requests more than five minutes old or ahead, altered bodies, missing signatures and inactive connectors are rejected before CRM processing. The maximum adapter payload is 64 KiB. Event IDs are idempotent per connector; accepted duplicates do not repeat CRM actions.

Payload version 1 supports `eventId`, `submittedAt`, `name`, `email`, `phone`, `message`, optional `subject`, `enquiryType`, HTTP(S) `pageUrl`/`referrer`, consent flags, bounded UTM fields and `externalCustomerId`. At least email or phone is required. Tenant identifiers and unknown fields are rejected. Submitted URLs are recorded as untrusted attribution and are never fetched.

Node sender (placeholder secret and synthetic data):

```js
import { createHmac } from "node:crypto";
const body = JSON.stringify({ version: "1", eventId: "synthetic-001", submittedAt: new Date().toISOString(), name: "Test Visitor", email: "visitor@example.test", message: "Please contact me" });
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", process.env.B2BRAIN_WEBSITE_SECRET).update(`${timestamp}.synthetic-001.${body}`).digest("hex");
await fetch("https://api.example.test/api/v1/integrations/website/enquiries/CONNECTOR_PUBLIC_ID", { method: "POST", headers: { "content-type": "application/json", "x-b2brain-timestamp": timestamp, "x-b2brain-event-id": "synthetic-001", "x-b2brain-signature": `v1=${signature}` }, body });
```

Python sender:

```python
import hashlib, hmac, json, os, time, urllib.request
payload = {"version": "1", "eventId": "synthetic-001", "submittedAt": "2026-09-06T10:00:00Z", "name": "Test Visitor", "email": "visitor@example.test", "message": "Please contact me"}
body = json.dumps(payload, separators=(",", ":")).encode()
timestamp = str(int(time.time()))
signature = hmac.new(os.environ["B2BRAIN_WEBSITE_SECRET"].encode(), timestamp.encode() + b"." + payload["eventId"].encode() + b"." + body, hashlib.sha256).hexdigest()
request = urllib.request.Request("https://api.example.test/api/v1/integrations/website/enquiries/CONNECTOR_PUBLIC_ID", data=body, method="POST", headers={"Content-Type": "application/json", "x-b2brain-timestamp": timestamp, "x-b2brain-event-id": payload["eventId"], "x-b2brain-signature": "v1=" + signature})
urllib.request.urlopen(request)
```

Responses expose only acceptance, duplicate/processing status and a correlation reference. Draft replies remain approval-controlled and are never sent externally. Website orders, payments, CAPTCHA, Meta, real WhatsApp and browser-direct signed delivery are not part of Phase B. The public route is mounted only when `EXTERNAL_CHANNELS_ENABLED` is enabled deliberately.

## Website order adapter (Phase C)

Phase C uses the same connector-specific HMAC headers and five-minute replay window at `POST /api/v1/integrations/website/orders/:connectorPublicId`. An authorized Automation manager must first enable the connector capability with `PUT /api/v1/automation-bridge/connectors/:id/website-orders` and `{ "enabled": true }`.

Payload version 1 contains `eventId`, `submittedAt`, `externalOrderId`, customer contact, `currency`, one to 50 SKU lines with positive integer quantities, and optional notes, shipping address, attribution and submitted display totals. SKU is resolved only against active catalogue items owned by the connector organization. Unknown, cross-tenant, duplicate or currency-mismatched SKU lines are rejected.

The backend always uses catalogue selling price and tax rate. Submitted display prices/totals are diagnostic only; a mismatch remains review-required. The resulting order is always `DRAFT`, `UNPAID` and `UNFULFILLED`, with zero discount and shipping. The atomic transaction creates the customer when needed, order, integration event, customer activity, notification and redacted audit. Event ID and a connector-scoped external-order-derived order number provide database-backed idempotency.

Synthetic senders use the Phase B signature algorithm; replace the enquiry payload with:

```json
{"version":"1","eventId":"synthetic-order-event-001","submittedAt":"2026-09-06T10:00:00Z","externalOrderId":"synthetic-shop-order-001","customer":{"name":"Test Buyer","email":"buyer@example.test"},"currency":"INR","items":[{"sku":"DEMO-SKU","quantity":1}]}
```

Successful responses contain only acceptance, duplicate/review status and a correlation reference. A website submission is not proof of payment: Phase C creates no payment, invoice, revenue, refund, stock reservation/deduction, fulfilment or external reply. Payment confirmation requires a future provider-signed payment webhook.

## Meta Lead Ads adapter (Phase D)

Phase D adds the disabled-by-default callback at `GET|POST /api/v1/integrations/meta/leads`. GET returns Meta's challenge only for `hub.mode=subscribe` and the server-side verify token. POST verifies the exact raw bytes with `X-Hub-Signature-256` and the server-side Meta App Secret before connector lookup or Graph access. `EXTERNAL_CHANNELS_ENABLED` and `META_LEAD_ADS_ENABLED` must both be deliberately enabled; `META_LEAD_GRAPH_ENABLED` separately controls real Graph retrieval.

An authorized Automation manager configures a `SOCIAL` / `META_LEAD_ADS` connector through `PUT /api/v1/automation-bridge/connectors/:id/meta-lead`. The Page ID is a digits-only string stored in the unique `metaPageId` column. Optional Form IDs are an allowlist. The Page token uses existing encrypted credential storage and is never returned. Saving identifiers leaves the connector in `DRAFT`; it must not become active until authorization and webhook verification have succeeded. Disable or reconnect by pausing the connector and replacing its encrypted credentials explicitly.

The Graph boundary accepts only `https://graph.facebook.com`, constructs its own versioned lead URL, uses an authorization header, limits time, retries, and response size, and maps failures to safe errors. Automated tests inject a deterministic fake client and never contact Meta. Supported standard fields are name, email, phone, company, message and requirement; unknown form answers are discarded unless explicitly mapped. No URL in a lead answer is fetched.

Verified leads normalize to `META_LEAD_AD` / `LEAD_CAPTURED`; organization and connector come only from the unique active Page mapping. Form allowlists are evaluated after Page resolution. The Meta lead ID is the external idempotency identity, and the adapter delegates CRM work exclusively to the shared inbound processor. Acknowledgements contain only accepted/processed state; diagnostics use correlation IDs and hashed Page/lead identifiers.

No reply, campaign change, audience upload, payment, order, revenue recognition, WhatsApp action or hosted-AI activation occurs in Phase D. Real activation still requires a Meta App, Lead Ads permissions and App Review, durable Page/system-user tokens, authorization verification, subscribed Pages, operational token rotation, privacy/compliance review, and production kill-switch approval. Use placeholders and the fake Graph client for local tests.

## Guided Meta connection (Phase E)

The authenticated Automation workspace now provides a guided Meta Lead Ads setup using a deterministic, offline fake provider. Authorization state is generated by the backend, stored only as a SHA-256 hash for ten minutes, bound to the active user, membership, organization and connector, and consumed atomically once. Return destinations are restricted to the relative `/automation` route. Expired and old consumed states are cleaned in bounded batches during authorization starts.

Test Mode exposes only synthetic Page and form choices. Page tokens and temporary authorization results use the existing encrypted connector fields and are never returned after selection. An empty form allowlist accepts no forms. Verification and synthetic tests remain `DRAFT` with `READY_TEST` configuration; they cannot make a connector production `ACTIVE`. Disconnect clears active encrypted credentials and Page ownership while preserving all historical CRM, audit and integration records.

Production activation still requires a separately implemented real provider, Meta App ID/secret configuration, an HTTPS OAuth callback registered with Meta, approved `leads_retrieval`, `pages_manage_metadata` and `pages_show_list` permissions, App Review, durable token operations, Page webhook subscription verification, privacy/compliance approval, and enabled external-channel kill switches. No real Meta network access, WhatsApp, hosted AI, external messages, campaigns or ad changes are enabled by Phase E.

## WhatsApp Cloud inbound foundation (Phase F)

The WhatsApp webhook remains disabled unless both external-channel and WhatsApp inbound switches are explicitly enabled. GET challenge verification uses the configured verification token. POST delivery verifies the exact captured request bytes with `X-Hub-Signature-256` and a constant-time HMAC comparison before parsing the bounded payload.

Organization identity comes only from the database-unique `metadata.phone_number_id` connector mapping. Sender, display phone, WABA, Business and Page identifiers never select a tenant. Verified text messages normalize into the shared inbound contract and delegate all CRM work to `InboundEventProcessor`; Meta message IDs remain the database idempotency key and generated replies stay internal approval drafts. Status callbacks update receipt/draft state without becoming enquiries. Unsupported media is recorded without downloading content or invoking CRM automation. Phase F performs no outbound WhatsApp or Meta API request.
