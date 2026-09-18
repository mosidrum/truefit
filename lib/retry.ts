export type RetryOptions = {
  /** Total attempts, including the first — default 3. */
  retries?: number;
  /** Base delay in ms; actual delay is baseDelayMs * 2^attempt — default 400. */
  baseDelayMs?: number;
  /** Whether a given error should trigger another attempt — default: always retry. */
  shouldRetry?: (error: unknown) => boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries an async operation with exponential backoff. Rethrows the last error once attempts are exhausted. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === retries - 1;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}

/** Retries OpenAI rate-limit/server errors and bare network failures; a
 * missing API key or a permanent 4xx (bad request/auth) won't be fixed by
 * retrying, so those fail immediately. */
export function isRetryableOpenAIError(error: unknown): boolean {
  if (error instanceof Error && error.message === "OPENAI_API_KEY is not set") {
    return false;
  }
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number") {
    return status === 429 || status >= 500;
  }
  return true;
}
