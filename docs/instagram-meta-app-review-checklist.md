# SATHOS Instagram App Review preparation (private-staging draft)

Status: preparation only. Do not publish, submit App Review, enable external customers or outbound replies, or set `META_INSTAGRAM_SIGNATURE_PROVEN=true` from this checklist. Legal owner review is required before entering public legal URLs in Meta.

SATHOS is an early-access software service currently operated by Harsh Soni in India and has not yet been incorporated as a separate legal entity. Registration is planned, with no promised date. This pre-incorporation wording is a draft for professional legal review, not a claim that the app is ready for Meta App Review.

## Official Meta sources checked (7 October 2026)

- [Instagram App Review](https://developers.facebook.com/documentation/instagram-platform/app-review): Advanced Access for a tech provider serving multiple businesses; permission explanations, reviewer access, and an end-to-end screencast for each requested permission.
- [Basic Settings](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings): app contact, category, privacy-policy, terms-of-service, data-deletion-instructions and icon fields. Terms and icon are required for Live mode.
- [Data Deletion Request Callback](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback): optional callback alternative to an instructions URL; signed POST and `{ "url", "confirmation_code" }` response if implemented; user-readable request status and prompt handling. The current SATHOS implementation is instructions-only.
- [Facebook Login access tokens / deauthorization](https://developers.facebook.com/documentation/facebook-login/web/accesstokens): says a deauthorization callback can be configured, but does not specify a complete Instagram Login signed-request/identity contract. Do not configure a deauthorization URL until this is verified and implemented.

## Manual values after legal and security review

Open the [SATHOS Social Connect app dashboard](https://developers.facebook.com/apps/1092028586872252/) and navigate to App settings → Basic. Use these public URLs only after reviewing their content and verifying that the deployed routes return 200 without authentication:

| Meta setting | Proposed value | Gate |
| --- | --- | --- |
| Privacy Policy URL | `https://sathos.in/privacy` | Owner/counsel approves the Instagram data disclosures and retention wording. |
| Terms of Service URL | `https://sathos.in/terms` | Owner/counsel approves the private-beta terms. |
| User Data Deletion Instructions URL | `https://sathos.in/data-deletion` | Route is deployed, public, and support workflow is staffed. |
| Data Deletion Request Callback URL | Leave unset | No safe callback or status workflow is implemented. Do not enter an instructions page into a callback field. |
| Deauthorize Callback URL (Instagram Business Login) | Leave unset | Signed payload and safe Instagram-asset ownership mapping remain unverified. |

Check the existing app icon, category and developer contact in Basic Settings; do not replace them without owner approval. Use the existing app's Instagram Business Login settings screen for its deauthorization field. A stable deep link to that screen was not verified, so navigate from the app dashboard rather than guessing a URL.

## Requested permissions and reviewer evidence

Request only `instagram_business_basic` and `instagram_business_manage_messages` for the present inbound-message use case. Do not request comments, publishing, advertising or outbound messaging based on this implementation.

| Permission | SATHOS use | Reviewer evidence |
| --- | --- | --- |
| `instagram_business_basic` | Identify and bind the authorized professional Instagram account to the correct SATHOS organization; show truthful connection status. | Show organization manager opening Automation → Connections, choosing Connect Instagram, Meta authorization, return to SATHOS, and private-test-ready status. |
| `instagram_business_manage_messages` | Receive customer-initiated Instagram DM webhook events and, only after separate signature and payload validation, create organization-scoped inquiries for human handling. | Show one consented test DM reaching the authorized organization's inquiry workflow, with account/tenant isolation and no outbound reply. Do not claim this works while inbound processing is blocked. |

Before recording or submitting, arrange a dedicated reviewer workspace and eligible professional Instagram test account through Meta's approved reviewer process. Supply access instructions and credentials only through Meta's secure reviewer fields, never in this repository. Do not use the private operator organization or a real customer account as a reviewer credential. Confirm the reviewer can reach the app and complete OAuth without manual intervention.

Reviewer steps, once the real-DM path has passed a controlled test:

1. Sign in to the dedicated SATHOS reviewer workspace using the credential supplied separately in Meta's secure field.
2. Open Automation → Connections → Instagram Messages and select Connect Instagram.
3. Authorize the eligible professional account on Meta, return to SATHOS, and observe the accurate connection state.
4. From a separate eligible test Instagram account, send a new customer-initiated DM to the connected account.
5. Refresh the inquiry workspace and inspect the new organization-scoped inquiry. Show no cross-organization access and no outbound message action.
6. Use Disconnect locally, and explain that this clears SATHOS credentials/routing but does not itself revoke the app at Meta.

Record one short end-to-end screencast for each permission, showing the visible login control, Meta consent, return state, relevant screen and effect. Use English UI or captions, explain non-obvious controls, and redact credentials, tokens, unrelated records and personal messages. Do not reuse a promotional reel as the only evidence. Record only with consented test accounts.

## Current blockers and release gates

- The app is unpublished; external customer authorization and outbound replies remain disabled.
- `META_INSTAGRAM_SIGNATURE_PROOF_ENABLED=false` and `META_INSTAGRAM_SIGNATURE_PROVEN=false`. A valid Meta Test signature did not prove a real DM payload or authorize normal intake. Run a separately approved real-DM compatibility test before changing this gate.
- The public Terms and deletion instructions require owner/counsel review and deployment before entering their URLs.
- A deauthorization callback is not implemented. Its signed payload and identity mapping must be verified from current primary Meta documentation before code or configuration.
- No data-deletion callback or public status-code workflow is implemented. Use the instructions URL route only until a safely scoped workflow exists.
- Before public paid launch, owner and counsel must review the formal legal identity after registration, any required registered address, governing-law selection, processor and international-processing disclosures, retention schedule, and support ownership. Do not publish a private residential address or invent registration details.

Publication checklist: legal approval → deploy and verify legal pages → complete safe callback decision → verify reviewer workspace and consented screencasts → finish permission-by-permission descriptions → independent security/tenant review → controlled real-DM test → decide Advanced Access submission → owner-authorized publication. Nothing in this document authorizes a submission.

Rollback checklist: if a controlled activation fails, leave or return inbound signature processing to blocked, disable external-customer access, stop new authorization, investigate scoped logs without secrets, and use authorized local disconnection only when needed. Do not claim that local disconnection revokes Meta access or deletes historical business records.
