import { describe, it, expect } from "vitest";
import { pickDay, SCHEDULE } from "@/lib/timetable";

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
  it("Monday period 1 is Spanish", () => {
    expect(SCHEDULE["الاثنين"][0]).toBe("إسبانية");
  });
});
