import { describe, expect, it } from "vitest";
import { approvalQuerySchema, auditQuerySchema, decisionSchema } from "../src/modules/governance/governance.validation.js";
describe("governance validation",()=>{
  it("accepts approval and validates decision reasons",()=>{expect(decisionSchema.parse({decision:"APPROVE"})).toEqual({decision:"APPROVE",note:null});expect(decisionSchema.parse({decision:"REJECT",note:"Customer consent is missing."}).note).toBe("Customer consent is missing.");expect(()=>decisionSchema.parse({decision:"RETURN"})).toThrow()});
  it("rejects tenant, actor and source identifiers from decision bodies",()=>{expect(()=>decisionSchema.parse({decision:"APPROVE",organizationId:crypto.randomUUID(),decidedById:crypto.randomUUID()})).toThrow()});
  it("bounds approval and audit queries",()=>{expect(approvalQuerySchema.parse({status:"PENDING",limit:"25"}).limit).toBe(25);expect(auditQuerySchema.parse({serviceCode:"AUTOMATION"}).limit).toBe(100);expect(()=>auditQuerySchema.parse({limit:"201"})).toThrow()});
});
