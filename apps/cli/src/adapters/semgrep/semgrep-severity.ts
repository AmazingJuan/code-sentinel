import type { Severity } from '../../domain/finding.js';

/**
 * RF-022: documented Semgrep severity mapping. Semgrep CE emits ERROR/WARNING/INFO; newer
 * versions may also emit CRITICAL/HIGH/MEDIUM/LOW.
 */
const SEMGREP_SEVERITY_MAP: Readonly<Record<string, Severity>> = {
  CRITICAL: 'critical',
  ERROR: 'high',
  HIGH: 'high',
  WARNING: 'medium',
  MEDIUM: 'medium',
  INFO: 'low',
  LOW: 'low',
};

export function mapSemgrepSeverity(semgrepSeverity: unknown): Severity | null {
  if (typeof semgrepSeverity !== 'string') return null;
  return SEMGREP_SEVERITY_MAP[semgrepSeverity.toUpperCase()] ?? null;
}
