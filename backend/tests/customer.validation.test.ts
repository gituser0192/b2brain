import { describe, expect, it } from "vitest";
import { createCustomerSchema, listCustomerQuerySchema } from "../src/modules/customers/customer.validation.js";

describe("customer validation", () => {
  it("accepts a person and normalizes optional fields", () => {
    expect(createCustomerSchema.parse({ type: "PERSON", firstName: " Ada ", lastName: " Lovelace ", email: "ada@example.com", phone: "", website: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "", status: "LEAD", notes: "" })).toMatchObject({ type: "PERSON", firstName: "Ada", lastName: "Lovelace", status: "LEAD" });
  });
  it("requires the correct name for each customer type", () => {
    expect(() => createCustomerSchema.parse({ type: "PERSON", status: "LEAD" })).toThrow();
    expect(() => createCustomerSchema.parse({ type: "COMPANY", status: "ACTIVE" })).toThrow();
  });
  it("rejects tenant and audit identifiers from clients", () => {
    expect(() => createCustomerSchema.parse({ type: "COMPANY", companyName: "Acme", status: "ACTIVE", organizationId: crypto.randomUUID(), createdById: crypto.randomUUID() })).toThrow();
  });
  it("bounds pagination and parses archive state", () => {
    expect(listCustomerQuerySchema.parse({ page: "2", pageSize: "50", archived: "true" })).toEqual({ page: 2, pageSize: 50, archived: true });
    expect(() => listCustomerQuerySchema.parse({ pageSize: "500" })).toThrow();
  });
});
