import { describe, expect, it } from "vitest";
import { contactSchema, conversionSchema, followUpSchema, inquirySchema, mergeMessageSchema } from "../src/modules/inquiries/inquiry.validation.js";

const inquiry = { source: "WHATSAPP", type: "UNCLASSIFIED", status: "NEW", priority: "MEDIUM", contactName: "A real customer", email: "customer@example.com", phone: "", companyName: "", subject: "Product question", message: "Please share the available sizes.", campaignId: null, assignedEmployeeId: null, responseDueAt: null, disqualifiedReason: "" };

describe("inquiry validation", () => {
  it("normalizes optional contact data", () => expect(inquirySchema.parse(inquiry)).toMatchObject({ phone: null, companyName: null, disqualifiedReason: null }));
  it("rejects trusted tenant and creator identifiers", () => expect(() => inquirySchema.parse({ ...inquiry, organizationId: crypto.randomUUID(), createdById: crypto.randomUUID() })).toThrow());
  it("requires email or phone", () => expect(() => inquirySchema.parse({ ...inquiry, email: "", phone: "" })).toThrow());
  it("only accepts target-specific conversion fields", () => expect(() => conversionSchema.parse({ target: "CUSTOMER", organizationId: crypto.randomUUID() })).toThrow());
  it("accepts a structured contact log", () => expect(contactSchema.parse({ channel: "CALL", summary: "Discussed the product requirement", details: "Customer requested a quotation." })).toMatchObject({ channel: "CALL" }));
  it("rejects tenant identifiers in contact logs", () => expect(() => contactSchema.parse({ channel: "CALL", summary: "Discussed requirements", organizationId: crypto.randomUUID() })).toThrow());
  it("parses a follow-up due date", () => expect(followUpSchema.parse({ dueAt: "2026-08-12T09:30:00.000Z", note: "Send the requested quotation" }).dueAt).toBeInstanceOf(Date));
  it("accepts a safe duplicate message merge", () => expect(mergeMessageSchema.parse({ source: "WHATSAPP", message: "Is this product still available?" })).toMatchObject({ source: "WHATSAPP" }));
  it("rejects trusted identifiers in merged messages", () => expect(() => mergeMessageSchema.parse({ source: "WEBSITE", message: "Please contact me", organizationId: crypto.randomUUID() })).toThrow());
});
