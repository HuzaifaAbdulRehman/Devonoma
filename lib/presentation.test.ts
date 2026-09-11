import { describe, expect, it } from "vitest";

import { firstCommitLine, formatTimestamp, shortCommitSha } from "./presentation";

describe("activity presentation", () => {
  it("keeps timeline timestamps stable in Pakistan Standard Time", () => {
    expect(formatTimestamp(new Date("2026-09-11T10:30:00Z"))).toBe(
      "Sep 11, 2026, 3:30 PM PKT",
    );
  });

  it("uses the subject and short SHA in compact rows", () => {
    expect(firstCommitLine("add timeline\n\nMore context")).toBe("add timeline");
    expect(shortCommitSha("0123456789abcdef")).toBe("0123456");
  });
});
