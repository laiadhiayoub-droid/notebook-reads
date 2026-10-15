import { describe, it, expect } from "vitest";
import { pickDay, SCHEDULE, mergeRow } from "@/lib/timetable";

describe("timetable day selection", () => {
  it("shows today before 17:05", () => {
    expect(pickDay(1, 17 * 60 + 4)).toEqual({ dayIndex: 1, mode: "today" });
  });
  it("shows tomorrow after 17:05", () => {
    expect(pickDay(1, 17 * 60 + 6)).toEqual({ dayIndex: 2, mode: "tomorrow" });
  });
  it("Friday and Saturday show Sunday", () => {
    expect(pickDay(5, 600).dayIndex).toBe(0);
    expect(pickDay(6, 600)).toEqual({ dayIndex: 0, mode: "tomorrow" });
  });
  it("Sunday period 1 is Sharia, Monday period 1 is Arabic", () => {
    expect(SCHEDULE["الأحد"][0]).toBe("شريعة");
    expect(SCHEDULE["الاثنين"][0]).toBe("لغة عربية");
  });
  it("merges Monday periods 5-6 Spanish but never across lunch", () => {
    expect(mergeRow(SCHEDULE["الاثنين"])).toContainEqual({ subject: "إسبانية", start: 4, span: 2 });
    expect(mergeRow(["a","b","c","x","x","d","e"]).find((b) => b.start === 4)?.span).toBe(1);
  });
});
