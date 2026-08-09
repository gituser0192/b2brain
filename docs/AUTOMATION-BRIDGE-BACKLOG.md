# B2-AUTOMATION-BRIDGE

Status: PENDING — begin only after the core B² Brain services are complete and stable.

When the user says `B2-AUTOMATION-BRIDGE`, review this backlog and continue with the first incomplete item.

## Planned foundation

1. Lead, inquiry, and source tracking.
2. Products and services catalogue.
3. Orders and line items.
4. Payments, refunds, and revenue records.
5. Inventory and product variants.
6. Organization-isolated integration event inbox.
7. Verified connectors for official WhatsApp Business, websites, commerce platforms, payment providers, email, and social lead sources.
8. Intake, sales, commerce, support, and website-development agents.

## Required behavior

- Match or create CRM customers using normalized phone/email identifiers with duplicate protection.
- Classify incoming events as inquiry, support request, complaint, sales opportunity, order request, order, payment, refund, or irrelevant/spam.
- Do not convert every message into a sales deal.
- Save incoming communication in the customer timeline.
- Create and assign inquiries, follow-ups, tasks, deals, orders, payments, and notifications when appropriate.
- Website purchases must update CRM, orders, payments, revenue, fulfilment, and inventory through verified webhooks.
- Support manual-approval, assisted, and policy-limited autonomous modes.
- Verify webhook signatures and integration organization ownership.
- Preserve organization isolation, permissions, consent, opt-outs, audit history, and idempotency.
- Never generate mock business records or invent missing customer information.
- Provide failure quarantine, retry controls, human escalation, and complete event traceability.

## Example target flows

- WhatsApp clothing query -> CRM contact -> inquiry -> customer timeline -> employee assignment -> notification -> approved/automatic response.
- Website purchase and payment -> CRM contact -> order and items -> payment -> revenue -> inventory -> fulfilment -> receipt and dashboard update.
- Website change request -> development agent clarification -> protected preview -> tests -> approval policy -> publish -> audit and rollback.

## Phase 1 implementation — August 4, 2026

Completed: organization-owned connectors, one-time secrets, an idempotent integration event inbox, payload hashes, trace IDs, manual approval, ignore/quarantine decisions, controlled retry records, and routing of approved communication events into Lead & Inquiry Management.

Still pending: official signed provider webhook adapters and credential vaulting, beginning with the provider selected by the user. Commerce, payment, refund, and website execution events remain intentionally blocked until their verified adapters exist.

## Phase 2 implementation — August 5, 2026

Completed for WhatsApp Business Cloud API: public subscription verification, raw-body `X-Hub-Signature-256` validation, encrypted phone/account/token/App Secret configuration, phone-number ownership routing, Meta message ID deduplication, safe handling of unsupported message types, CRM customer matching, approval-held inquiry intake, reply drafting, explicit send approval, Graph API delivery, and recorded failures.

Deployment still required before Meta can call it: expose the backend through a public HTTPS domain, configure the generated callback URL and one-time verify token in Meta, subscribe the app to WhatsApp message webhooks, and enter real Meta credentials through the Automation dashboard.
