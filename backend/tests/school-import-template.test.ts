import path from "node:path";
import readExcelFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";

describe("school import workbook", () => {
  it("contains supported sheets and no seeded business rows", async () => {
    const sheets = await readExcelFile(
      path.resolve(
        process.cwd(),
        "../frontend/public/templates/b2-school-import-template.xlsx",
      ),
    );
    const students = sheets.find((sheet) => sheet.sheet === "Students"),
      teachers = sheets.find((sheet) => sheet.sheet === "Teachers");
    expect(students?.data[0]?.[0]).toBe("First Name*");
    expect(teachers?.data[0]?.[0]).toBe("First Name*");
    const populatedBusinessRows = [students, teachers].flatMap((sheet) => {
      return (sheet?.data.slice(1) ?? []).filter((row) =>
        row.some((value) => String(value ?? "").trim()),
      );
    });
    expect(populatedBusinessRows).toEqual([]);
  });
});
