export const DEFAULT_TIMEOUT_MS = 25_000;

const MAX_ERROR_DETAIL_LENGTH = 300;

/** Strips credentials, query and fragment so URLs can be printed safely. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '<invalid url>';
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    const safeUrl = redactUrl(url);
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error(
          `Request to "${safeUrl}" timed out after ${timeoutMs / 1000}s. The backend may be offline, suspended, or unreachable.`,
        );
      }
      const code = (error as { code?: unknown }).code ?? (error.cause as { code?: unknown })?.code;
      if (code === 'ENOTFOUND') {
        throw new Error(
          `Backend host not found at "${safeUrl}". Check network connection or verify the backend address.`,
        );
      }
      if (code === 'ECONNREFUSED') {
        throw new Error(
          `Connection refused at "${safeUrl}". Verify that the backend service is running and accessible.`,
        );
      }
    }
    throw error;
  }
}

/**
 * Makes a backend error body safe to print: keeps the NestJS `message` when present,
 * masks bearer tokens and JWTs, and truncates, so responses that echo request data
 * never leak credentials into terminals or CI logs.
 */
export function sanitizeErrorDetail(body: string): string {
  let detail = body;
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (Array.isArray(parsed.message)) {
      detail = parsed.message.map(String).join('; ');
    } else if (typeof parsed.message === 'string') {
      detail = parsed.message;
    }
  } catch {
    // Not JSON: fall back to the raw text.
  }
  const masked = detail
    .replace(/Bearer\s+[\w.~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED_JWT]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!masked) return 'no detail provided';
  return masked.length > MAX_ERROR_DETAIL_LENGTH
    ? `${masked.slice(0, MAX_ERROR_DETAIL_LENGTH)}...`
    : masked;
}

export async function readErrorDetail(response: Response): Promise<string> {
  try {
    return sanitizeErrorDetail(await response.text());
  } catch {
    return 'no detail provided';
  }
}
