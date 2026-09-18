import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result on the first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds after failing fewer times than the retry budget", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("recovered");

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 10 });
    // Let each backoff timer fire so the retried attempts can run.
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error once retries are exhausted", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("final failure"));

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 10 });
    // Attach the rejection handler before advancing timers so the eventual
    // rejection is never briefly unhandled.
    const assertion = expect(promise).rejects.toThrow("final failure");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("not retryable"));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(withRetry(fn, { retries: 3, shouldRetry })).rejects.toThrow(
      "not retryable"
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff between attempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 100 });

    // No retry has run yet.
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100); // 100 * 2^0
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(200); // 100 * 2^1
    expect(fn).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe("ok");
  });
});
