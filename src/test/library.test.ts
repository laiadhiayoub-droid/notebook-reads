import { describe, it, expect } from "vitest";
import { CONTENT_TYPES, SUBJECTS } from "@/lib/library";

describe("library rules", () => {
  it("content type has exactly lesson and summary", () => {
    expect(CONTENT_TYPES.map((c) => c.label)).toEqual(["درس", "ملخص"]);
  });
  it("has the 8 fixed 2AS subjects", () => {
    expect(SUBJECTS).toHaveLength(8);
    expect(SUBJECTS[0].label).toBe("اللغة الإسبانية");
  });
});
