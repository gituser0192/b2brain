import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { metaGraphLeadSchema, type MetaGraphLead } from "./meta-lead.validation.js";

export interface MetaLeadGraphClient { retrieve(leadId: string, accessToken: string): Promise<MetaGraphLead>; }
export class DisabledMetaLeadGraphClient implements MetaLeadGraphClient { retrieve(): Promise<never> { return Promise.reject(new AppError(503, "Meta lead retrieval is disabled.", "META_LEAD_GRAPH_DISABLED")); } }
export class HttpMetaLeadGraphClient implements MetaLeadGraphClient {
  async retrieve(leadId: string, accessToken: string) {
    if (!env.META_LEAD_GRAPH_ENABLED) return new DisabledMetaLeadGraphClient().retrieve();
    const base = new URL(env.META_LEAD_GRAPH_BASE_URL);
    if (base.protocol !== "https:" || base.hostname !== "graph.facebook.com" || base.username || base.password) throw new AppError(503, "Meta lead retrieval is unavailable.", "META_GRAPH_CONFIGURATION_INVALID");
    const url = new URL(`/${env.META_GRAPH_API_VERSION}/${leadId}`, base); url.searchParams.set("fields", "id,created_time,ad_id,campaign_id,form_id,field_data");
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), env.META_LEAD_GRAPH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }, signal: controller.signal });
        if (Number(response.headers.get("content-length") ?? 0) > 256 * 1024) throw new AppError(502, "Meta lead response was invalid.", "META_GRAPH_RESPONSE_TOO_LARGE");
        if (!response.ok) { if (attempt < env.META_LEAD_GRAPH_MAX_RETRIES && (response.status === 429 || response.status >= 500)) continue; throw new AppError(502, "Meta lead retrieval failed.", "META_GRAPH_REQUEST_FAILED"); }
        const text = await response.text(); if (Buffer.byteLength(text) > 256 * 1024) throw new AppError(502, "Meta lead response was invalid.", "META_GRAPH_RESPONSE_TOO_LARGE");
        return metaGraphLeadSchema.parse(JSON.parse(text));
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (attempt < env.META_LEAD_GRAPH_MAX_RETRIES) continue;
        throw new AppError(502, "Meta lead retrieval failed.", "META_GRAPH_REQUEST_FAILED");
      } finally { clearTimeout(timer); }
    }
  }
}
