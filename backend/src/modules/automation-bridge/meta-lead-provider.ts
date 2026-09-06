import { AppError } from "../../shared/errors/app-error.js";

export const META_LEAD_REQUIRED_PERMISSIONS = ["leads_retrieval", "pages_manage_metadata", "pages_show_list"] as const;
export type MetaPageChoice = { id: string; name: string; token: string; permissions: string[] };
export type MetaFormChoice = { id: string; name: string };

export interface MetaLeadConnectionProvider {
  readonly mode: "TEST" | "PRODUCTION";
  buildAuthorizationUrl(state: string, returnPath: string): string;
  exchangeCode(code: string): Promise<{ pages: MetaPageChoice[]; expiresAt: string }>;
  listForms(pageId: string): Promise<MetaFormChoice[]>;
  subscribe(pageId: string): Promise<boolean>;
  verifySubscription(pageId: string): Promise<boolean>;
  revoke(pageId: string): Promise<boolean>;
  syntheticLead(pageId: string, formId: string): Promise<{ id: string; name: string; email: string; message: string }>;
}

export class FakeMetaLeadConnectionProvider implements MetaLeadConnectionProvider {
  readonly mode = "TEST" as const;
  buildAuthorizationUrl(state: string, returnPath: string) { return `${returnPath}${returnPath.includes("?") ? "&" : "?"}meta_code=fake-approved&meta_state=${encodeURIComponent(state)}`; }
  exchangeCode(code: string) {
    if (code !== "fake-approved") return Promise.reject(new AppError(400, "Meta authorization failed.", "META_AUTHORIZATION_FAILED"));
    return Promise.resolve({ pages: [{ id: "900000000000001", name: "Synthetic Test Page", token: "synthetic-page-token-for-local-tests-only", permissions: [...META_LEAD_REQUIRED_PERMISSIONS] }], expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  }
  listForms(pageId: string) { this.page(pageId); return Promise.resolve([{ id: "910000000000001", name: "Synthetic Enquiry Form" }, { id: "910000000000002", name: "Synthetic Admissions Form" }]); }
  subscribe(pageId: string) { this.page(pageId); return Promise.resolve(true); }
  verifySubscription(pageId: string) { this.page(pageId); return Promise.resolve(true); }
  revoke(pageId: string) { this.page(pageId); return Promise.resolve(true); }
  syntheticLead(pageId: string, formId: string) { this.page(pageId); if (!formId.startsWith("91")) return Promise.reject(new AppError(400, "The selected form is unavailable.", "META_FORM_UNAVAILABLE")); return Promise.resolve({ id: `test-${Date.now()}`, name: "Synthetic Meta Lead", email: "meta-lead@example.test", message: "Synthetic Meta Lead Ads pipeline verification." }); }
  private page(pageId: string) { if (pageId !== "900000000000001") throw new AppError(400, "The selected Page is unavailable.", "META_PAGE_UNAVAILABLE"); }
}
