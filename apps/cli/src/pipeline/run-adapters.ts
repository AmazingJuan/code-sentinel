import type { NormalizedFinding, ParsedFinding } from '../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../domain/tool-adapter.js';
import { normalizeFinding } from './normalize-finding.js';

export interface ToolTiming {
  sourceTool: string;
  durationMs: number;
  ok: boolean;
}

export interface PipelineResult {
  findings: NormalizedFinding[];
  errors: string[];
  timings: ToolTiming[];
}

interface AdapterOutcome {
  findings: NormalizedFinding[];
  error: string | null;
  timing: ToolTiming;
}

async function runOne(adapter: ToolAdapter, target: ScanTarget): Promise<AdapterOutcome> {
  const startedAt = performance.now();
  const timing = (ok: boolean): ToolTiming => ({
    sourceTool: adapter.sourceTool,
    durationMs: Math.round(performance.now() - startedAt),
    ok,
  });
  try {
    const rawReport = await adapter.run(target);
    const parsedFindings = adapter.parse(rawReport, target);
    const findings = parsedFindings.map((parsedFinding: ParsedFinding): NormalizedFinding =>
      normalizeFinding(parsedFinding, adapter),
    );
    return { findings, error: null, timing: timing(true) };
  } catch (error: unknown) {
    return {
      findings: [],
      error: error instanceof Error ? error.message : String(error),
      timing: timing(false),
    };
  }
}

/**
 * run -> parse -> normalize for every tool in parallel, so total time is that of the
 * slowest tool. A failing tool records an error while the others continue (RF-030).
 * Results keep the adapter registration order.
 */
export async function runAdapters(
  adapters: readonly ToolAdapter[],
  target: ScanTarget,
): Promise<PipelineResult> {
  const outcomes = await Promise.all(
    adapters.map((adapter: ToolAdapter): Promise<AdapterOutcome> => runOne(adapter, target)),
  );

  return {
    findings: outcomes.flatMap((outcome: AdapterOutcome): NormalizedFinding[] => outcome.findings),
    errors: outcomes
      .map((outcome: AdapterOutcome): string | null => outcome.error)
      .filter((error: string | null): error is string => error !== null),
    timings: outcomes.map((outcome: AdapterOutcome): ToolTiming => outcome.timing),
  };
}
