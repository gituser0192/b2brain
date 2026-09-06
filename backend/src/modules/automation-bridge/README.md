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

Website, commerce, Meta Lead Ads and WhatsApp Cloud API adapters remain inactive. The WhatsApp UI is still a simulator and performs no external delivery. Hosted AI is not required by this ingestion path.
