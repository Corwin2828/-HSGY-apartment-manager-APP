import { describe, expect, it } from "vitest";

import { checkRateLimit } from "@/lib/rate-limit/memory";

describe("memory rate limit", () => {
  it("should allow requests under the threshold", () => {
    const key = `test-allow-${Date.now()}`;

    const first = checkRateLimit({ key, max: 2, windowSec: 60 });
    const second = checkRateLimit({ key, max: 2, windowSec: 60 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("should block requests after the threshold", () => {
    const key = `test-block-${Date.now()}`;

    checkRateLimit({ key, max: 1, windowSec: 60 });
    const blocked = checkRateLimit({ key, max: 1, windowSec: 60 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
