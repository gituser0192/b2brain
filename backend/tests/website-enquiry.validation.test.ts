import { describe, expect, it } from "vitest";
import { websiteEnquirySchema } from "../src/modules/automation-bridge/website-enquiry.validation.js";

const valid = {
  version: "1", eventId: "web-001", submittedAt: "2026-09-06T10:00:00.000Z",
  name: "Synthetic Visitor", email: " Visitor@Example.Test ", phone: "+91 98765-43210",
  message: "Please tell me about your services.", pageUrl: "https://example.test/contact",
};

describe("website enquiry validation", () => {
  it("normalizes contact fields and accepts bounded HTTP URLs", () => {
    expect(websiteEnquirySchema.parse(valid)).toMatchObject({ email: "visitor@example.test", phone: "919876543210" });
  });

  it("requires a contact method and rejects tenant identifiers", () => {
    expect(() => websiteEnquirySchema.parse({ ...valid, email: undefined, phone: undefined })).toThrow();
    expect(() => websiteEnquirySchema.parse({ ...valid, organizationId: crypto.randomUUID() })).toThrow();
  });

  it("rejects malformed timestamps, unsafe URLs, oversized text and unknown keys", () => {
    expect(() => websiteEnquirySchema.parse({ ...valid, submittedAt: "yesterday" })).toThrow();
    expect(() => websiteEnquirySchema.parse({ ...valid, pageUrl: "file:///etc/passwd" })).toThrow();
    expect(() => websiteEnquirySchema.parse({ ...valid, message: "x".repeat(4097) })).toThrow();
    expect(() => websiteEnquirySchema.parse({ ...valid, constructor: { prototype: { polluted: true } } })).toThrow();
  });
});
