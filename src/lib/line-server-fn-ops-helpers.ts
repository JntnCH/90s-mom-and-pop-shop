export interface LineApiRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
}

export interface LineApiCallResult {
  ok: boolean;
  status: number;
  bodyText: string;
  attempts: number;
}

/**
 * Wrapper function for LINE Messaging API with Exponential Backoff Auto-Retry
 * Handles HTTP 429 (Rate Limit), 5xx server errors, and network timeouts
 */
export async function callLineMessagingApiWithRetry(
  endpoint: string,
  token: string,
  body: unknown,
  options: LineApiRetryOptions = {},
): Promise<LineApiCallResult> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 10000;

  let lastStatus = 0;
  let lastBodyText = "";
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);
      lastStatus = response.status;
      lastBodyText = await response.text();

      // HTTP 2xx: Success
      if (response.ok) {
        return { ok: true, status: response.status, bodyText: lastBodyText, attempts: attempt };
      }

      // Check if retryable: 429 Too Many Requests or 5xx Server Error
      const isRetryable =
        response.status === 429 || (response.status >= 500 && response.status <= 504);

      if (!isRetryable || attempt >= maxRetries) {
        return { ok: false, status: response.status, bodyText: lastBodyText, attempts: attempt };
      }

      // Exponential backoff with jitter and Retry-After support
      let delayMs = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      const retryAfterHeader = response.headers.get("retry-after");
      if (retryAfterHeader) {
        const parsedSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsedSec) && parsedSec > 0) {
          delayMs = Math.min(parsedSec * 1000, 15000);
        }
      }

      console.warn(
        `[LINE Messaging API] Request failed with HTTP ${response.status} (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delayMs)}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      lastErrorMessage = err instanceof Error ? err.message : String(err);

      console.warn(
        `[LINE Messaging API Network/Timeout] Error on attempt ${attempt}/${maxRetries}: ${lastErrorMessage}`,
      );

      if (attempt >= maxRetries) {
        return {
          ok: false,
          status: 0,
          bodyText: `Network/Timeout error: ${lastErrorMessage}`,
          attempts: attempt,
        };
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    ok: false,
    status: lastStatus,
    bodyText: lastBodyText || lastErrorMessage || "Unknown error",
    attempts: maxRetries,
  };
}
