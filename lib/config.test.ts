import { describe, expect, it } from "vitest";

import { requiredEnv } from "./config";

describe("requiredEnv", () => {
  it("returns a configured value", () => {
    expect(requiredEnv("DATABASE_URL", { DATABASE_URL: "postgres://local" })).toBe(
      "postgres://local",
    );
  });

  it("rejects a missing or blank value", () => {
    expect(() => requiredEnv("WEBHOOK_SECRET", {})).toThrow(
      "WEBHOOK_SECRET is required",
    );
    expect(() => requiredEnv("WEBHOOK_SECRET", { WEBHOOK_SECRET: "   " })).toThrow(
      "WEBHOOK_SECRET is required",
    );
  });
});
