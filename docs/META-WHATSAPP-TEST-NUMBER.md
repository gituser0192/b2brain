# Meta WhatsApp Cloud API — Phase 1 test-number setup

This integration is restricted to Meta's test WhatsApp number and explicitly allowlisted test recipients. It is not a production-number migration, campaign, broadcast, or marketing implementation.

## Architecture

`Meta test message → signed webhook → durable IntegrationEvent receipt → Meta receipt dispatcher → existing EnquiryAgentService → CRM/inquiry/activity/follow-up → existing approval/takeover controls → approved test-number send adapter → Meta status webhook`

The webhook payload never selects an organization. The received `phone_number_id` must equal the server configuration and resolve to exactly one active `META_WHATSAPP_CLOUD` IntegrationConnector whose organization is active.

## Required Meta dashboard values

From **Meta for Developers → your app → WhatsApp → API Setup / Configuration**, collect:

- App Secret
- Temporary test access token (or a system-user token limited to the test app)
- Test Phone Number ID
- WhatsApp Business Account ID
- A random webhook verification token that you create yourself
- One or more recipient phone numbers registered in Meta's test-recipient list

Do not place any real value in source control, frontend environment variables, screenshots, or support messages.

## Backend environment variables

Configure these only in the backend/Render environment:

```text
META_WHATSAPP_ENABLED=true
META_WHATSAPP_OUTBOUND_ENABLED=false
META_WHATSAPP_VERIFY_TOKEN=<random-private-verification-token>
META_WHATSAPP_APP_SECRET=<Meta-app-secret>
META_WHATSAPP_ACCESS_TOKEN=<Meta-test-access-token>
META_WHATSAPP_PHONE_NUMBER_ID=<Meta-test-phone-number-id>
META_WHATSAPP_BUSINESS_ACCOUNT_ID=<Meta-test-WABA-id>
META_WHATSAPP_ALLOWED_TEST_RECIPIENTS=<comma-separated-E.164-digits>
META_WHATSAPP_WEBHOOK_TIMEOUT_MS=10000
META_WHATSAPP_PROVIDER_TIMEOUT_MS=10000
META_WHATSAPP_MAX_RETRIES=2
META_GRAPH_API_VERSION=<supported-version-such-as-v23.0>
```

Keep outbound disabled until inbound processing, CRM creation, approval, human takeover, and source attribution have been checked.

## B² Brain connector

Create one organization-owned Automation connector with:

- Type: `WHATSAPP`
- Provider: `META_WHATSAPP_CLOUD`
- Status: `ACTIVE`
- Phone Number ID: the same test Phone Number ID configured on the backend
- Business Account ID: the Meta test WABA ID

There must be exactly one active connector for the configured test Phone Number ID. The organization and its owner membership must remain active. Connector mode controls sending:

- `MANUAL_APPROVAL` or `ASSISTED`: every generated response waits for approval.
- `POLICY_LIMITED`: only low-risk responses that the existing agent policy marks approved may be considered for sending.

Pricing, complaints, refunds, payments, unsafe requests, missing knowledge, unsupported media, and human takeover remain approval-held or human-only.

## Public webhook

Use this HTTPS callback URL in Meta:

```text
https://<your-render-backend-host>/api/v1/webhooks/whatsapp
```

GET verification and signed POST delivery use the same path. The older connector-key path remains accepted only for backward compatibility; new Meta test setup should use the path above.

## Verify and subscribe in Meta

1. Deploy the backend to a public HTTPS Render URL.
2. Set the backend environment variables and restart the service.
3. Open **WhatsApp → Configuration → Webhook** in the Meta dashboard.
4. Enter the public callback URL above.
5. Enter the exact private value from `META_WHATSAPP_VERIFY_TOKEN`.
6. Complete verification.
7. Subscribe the WhatsApp Business Account to the `messages` field. This field carries inbound messages and sent/delivered/read/failed status updates.

## Add a test recipient

1. In **WhatsApp → API Setup**, add and verify a recipient phone number using Meta's test-recipient flow.
2. Store the number as digits in `META_WHATSAPP_ALLOWED_TEST_RECIPIENTS` (comma-separated for multiple test recipients).
3. Restart the backend after changing the allowlist.

## First test conversation

1. Leave `META_WHATSAPP_OUTBOUND_ENABLED=false`.
2. From the verified recipient, send a text message to Meta's test number.
3. In B² Brain, verify the organization received one IntegrationEvent, CRM customer/inquiry/activity, and any required follow-up.
4. Verify the Agent Playground/Audit view identifies `REAL_AI` or `DETERMINISTIC_FALLBACK` and lists approved knowledge sources.
5. Send the same webhook/message ID again and verify no CRM record is duplicated.
6. Enable human takeover and send another message; verify no automatic reply draft is sent.
7. Test a refund/payment request and confirm it remains high-risk and approval-held.
8. After approval testing, set `META_WHATSAPP_OUTBOUND_ENABLED=true` and restart.
9. Send only to an allowlisted Meta test recipient. Approved agent drafts can be delivered through `POST /api/v1/automation-bridge/meta-whatsapp/drafts/:id/send` by an authenticated user with `AUTOMATION_MANAGE`.
10. Confirm Meta status callbacks update the draft provider status to `SENT`, `DELIVERED`, `READ`, or `FAILED`.

## Emergency disable

Set either or both values to `false` in Render and restart:

```text
META_WHATSAPP_ENABLED=false
META_WHATSAPP_OUTBOUND_ENABLED=false
```

Disable outbound first if inbound CRM capture should continue. Pausing or archiving the organization connector also blocks processing for that organization.

## Troubleshooting

- **Webhook verification fails:** compare the Meta verification token with `META_WHATSAPP_VERIFY_TOKEN`; do not use the App Secret in that field.
- **POST signature rejected:** confirm `META_WHATSAPP_APP_SECRET` belongs to the same Meta app and that no proxy changes the raw request body.
- **Unknown connector:** confirm the connector provider is `META_WHATSAPP_CLOUD`, status is active, and Phone Number ID exactly matches the backend value.
- **No outbound message:** confirm the draft is approved, human takeover is off, outbound is enabled, and the recipient is allowlisted in both Meta and B² Brain.
- **Failed delivery:** inspect the redacted receipt/draft failure code and Meta dashboard; tokens, full phone numbers, and message bodies must not be copied into logs.
- **Repeated webhook:** this is normal. Meta message IDs and durable receipt IDs make processing idempotent.
- **Temporary Meta error:** transient timeouts, rate limits, and server errors are retried within configured limits. Validation and permission errors are recorded without indefinite retries.

Success with Meta's test number does not establish production readiness. A later phase must cover production-number onboarding, token rotation, durable queue scale, monitoring, privacy retention, Meta policy review, and controlled rollout.
