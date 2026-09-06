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
