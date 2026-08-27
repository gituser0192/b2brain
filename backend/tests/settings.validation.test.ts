import { describe, expect, it } from "vitest";
import { businessProfileSchema, changePasswordSchema, personalProfileSchema } from "../src/modules/settings/settings.validation.js";

describe("settings validation", () => {
  it("accepts safe personal and business profile values", () => {
    expect(personalProfileSchema.parse({ firstName: "Harsh", lastName: "Soni" })).toMatchObject({ firstName: "Harsh" });
    expect(businessProfileSchema.parse({ name: "B2 Brain", industry: "Technology", phone: "+91 9466043091", businessSize: "2_TO_10", monthlyRevenueRange: "1_TO_5_LAKH", primaryBusinessGoal: "AUTOMATE_OPERATIONS", timezone: "Asia/Kolkata", currency: "INR" })).toMatchObject({ currency: "INR" });
  });
  it("rejects weak, reused and unexpected password fields", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "Oldpass1", newPassword: "short" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "Samepass1", newPassword: "Samepass1" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "Oldpass1", newPassword: "Newpass2", userId: crypto.randomUUID() }).success).toBe(false);
  });
});
