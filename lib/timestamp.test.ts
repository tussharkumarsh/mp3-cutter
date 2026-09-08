import { describe, expect, it } from "vitest";
import { microsecondsToTimestamp, parseTimestampToMicroseconds } from "./timestamp";
import { validateSegment } from "./validation";

describe("timestamp precision", () => {
  it("parses supported timestamp forms as integer microseconds", () => {
    expect(parseTimestampToMicroseconds("00:00:04")).toBe(4_000_000);
    expect(parseTimestampToMicroseconds("00:00:04.5")).toBe(4_500_000);
    expect(parseTimestampToMicroseconds("4.5")).toBe(4_500_000);
    expect(parseTimestampToMicroseconds("00:00:04.123456")).toBe(4_123_456);
    expect(parseTimestampToMicroseconds("01:23:45.999999")).toBe(5_025_999_999);
    expect(parseTimestampToMicroseconds("00:01:05.1234567")).toBeNull();
  });

  it("round trips display values", () => {
    expect(microsecondsToTimestamp(83_456_789)).toBe("00:01:23.456789");
  });

  it("validates segment bounds and totals durations", () => {
    const values = [54, 15, 21, 14, 18, 5, 26];
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(153);
    expect(validateSegment("00:00:10", "00:00:20", 20_000_000).valid).toBe(true);
    expect(validateSegment("00:00:20", "00:00:10", 30_000_000).valid).toBe(false);
    expect(validateSegment("00:00:10", "00:00:31", 30_000_000).valid).toBe(false);
  });
});
