import { test, expect } from "bun:test";
import { advance, addDays, addMonthsClamped, daysInMonth } from "./dates.ts";

// --- advance: weekly ---

test("weekly, not overdue — pushes the current due date one week", () => {
  expect(advance("2026-05-22", "weekly", "2026-05-15")).toBe("2026-05-29");
});

test("weekly, overdue, today IS the anchor weekday — jumps to next week (timesheet)", () => {
  // Due last Friday, today is Friday -> next Friday, not today.
  expect(advance("2026-05-08", "weekly", "2026-05-15")).toBe("2026-05-22");
});

test("weekly, overdue, today mid-week — jumps to this coming anchor weekday", () => {
  // Anchor Friday, today Wednesday -> the Friday two days out.
  expect(advance("2026-05-01", "weekly", "2026-05-13")).toBe("2026-05-15");
});

// --- advance: monthly ---

test("monthly, not overdue — adds one month", () => {
  expect(advance("2026-05-26", "monthly", "2026-05-15")).toBe("2026-06-26");
});

test("monthly, not overdue, due next month — adds one month", () => {
  expect(advance("2026-06-26", "monthly", "2026-05-15")).toBe("2026-07-26");
});

test("monthly, overdue — next anchor day this month when it is still ahead", () => {
  expect(advance("2026-02-26", "monthly", "2026-05-15")).toBe("2026-05-26");
});

test("monthly, overdue, anchor day already passed this month — rolls to next month", () => {
  expect(advance("2026-02-26", "monthly", "2026-05-28")).toBe("2026-06-26");
});

test("monthly, overdue, anchor 31 with today Feb 28 — must land strictly after today", () => {
  // Feb clamps 31 -> Feb 28 == today, so the loop must roll forward to March.
  expect(advance("2026-01-31", "monthly", "2026-02-28")).toBe("2026-03-31");
});

test("monthly, overdue, anchor 30 with today Feb 28 — must land strictly after today", () => {
  expect(advance("2026-01-30", "monthly", "2026-02-28")).toBe("2026-03-30");
});

test("monthly, overdue across a year boundary", () => {
  expect(advance("2025-12-26", "monthly", "2026-01-03")).toBe("2026-01-26");
});

test("due == today is not overdue — monthly adds a month", () => {
  expect(advance("2026-05-15", "monthly", "2026-05-15")).toBe("2026-06-15");
});

// --- addMonthsClamped ---

test("addMonthsClamped clamps Jan 31 to Feb 28 in a non-leap year", () => {
  expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
});

test("addMonthsClamped clamps Jan 31 to Feb 29 in a leap year", () => {
  expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
});

test("addMonthsClamped rolls the year over", () => {
  expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
});

// --- addDays / daysInMonth ---

test("addDays rolls across a year boundary", () => {
  expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
});

test("daysInMonth knows February and short months", () => {
  expect(daysInMonth(2026, 2)).toBe(28);
  expect(daysInMonth(2028, 2)).toBe(29);
  expect(daysInMonth(2026, 4)).toBe(30);
});
