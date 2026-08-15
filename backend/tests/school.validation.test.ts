import { describe, expect, it } from "vitest";
import { academicYearSchema, schoolClassSchema, schoolSectionSchema } from "../src/modules/school/school.validation.js";

describe("school foundation validation", () => {
  it("accepts a valid academic year and rejects tenant ownership fields", () => {
    expect(academicYearSchema.parse({ name: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31", isCurrent: true }).name).toBe("2026-27");
    expect(() => academicYearSchema.parse({ name: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31", isCurrent: true, organizationId: crypto.randomUUID() })).toThrow();
  });
  it("requires the year to end after it starts", () => expect(() => academicYearSchema.parse({ name: "Bad year", startsOn: "2027-04-01", endsOn: "2027-03-31", isCurrent: false })).toThrow());
  it("normalizes class codes and rejects frontend actor fields", () => {
    expect(schoolClassSchema.parse({ academicYearId: crypto.randomUUID(), name: "Grade 1", code: "g1", sortOrder: 1 }).code).toBe("G1");
    expect(() => schoolSectionSchema.parse({ classId: crypto.randomUUID(), name: "A", room: "101", capacity: 40, createdById: crypto.randomUUID() })).toThrow();
  });
});
