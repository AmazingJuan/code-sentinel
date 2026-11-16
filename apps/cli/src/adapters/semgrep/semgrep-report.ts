/** Partes del JSON de `semgrep --json` que usa el CLI. El resto del reporte se ignora. */
export interface SemgrepResult {
  check_id: string;
  path: string;
  start: { line: number };
  extra: {
    message?: string;
    severity?: string;
    metadata?: { recommendation?: unknown };
  };
}

export interface SemgrepReport {
  results: SemgrepResult[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isSemgrepResult(value: unknown): value is SemgrepResult {
  return (
    isRecord(value) &&
    typeof value.check_id === 'string' &&
    typeof value.path === 'string' &&
    isRecord(value.start) &&
    typeof value.start.line === 'number' &&
    isRecord(value.extra)
  );
}

export function isSemgrepReport(value: unknown): value is SemgrepReport {
  return isRecord(value) && Array.isArray(value.results) && value.results.every(isSemgrepResult);
}
