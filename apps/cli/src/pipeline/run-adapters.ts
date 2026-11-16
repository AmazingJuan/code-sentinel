import type { NormalizedFinding, ParsedFinding } from '../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../domain/tool-adapter.js';
import { normalizeFinding } from './normalize-finding.js';

export interface PipelineResult {
  findings: NormalizedFinding[];
  errors: string[];
}

/**
 * run → parse → normalize para cada herramienta, una tras otra.
 * Si una herramienta falla, se anota el error y las demás siguen (RF-030).
 */
export async function runAdapters(
  adapters: readonly ToolAdapter[],
  target: ScanTarget,
): Promise<PipelineResult> {
  const findings: NormalizedFinding[] = [];
  const errors: string[] = [];

  for (const adapter of adapters) {
    try {
      const rawReport = await adapter.run(target);
      const parsedFindings = adapter.parse(rawReport, target);
      const normalized = parsedFindings.map((parsedFinding: ParsedFinding): NormalizedFinding =>
        normalizeFinding(parsedFinding, adapter),
      );
      findings.push(...normalized);
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { findings, errors };
}
