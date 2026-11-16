import { describe, expect, it } from 'vitest';

import { InvalidFindingError } from '../domain/errors.js';
import type { ParsedFinding } from '../domain/finding.js';
import { normalizeFinding } from './normalize-finding.js';

const semgrepTool = { sourceTool: 'Semgrep', toolCategory: 'SAST' } as const;

function buildParsedFinding(overrides: Partial<ParsedFinding> = {}): ParsedFinding {
  return {
    type: 'no-eval',
    severity: 'high',
    filePath: 'src/unsafe.ts',
    line: 2,
    description: 'eval() permite ejecutar código arbitrario',
    recommendation: null,
    ...overrides,
  };
}

describe('normalizeFinding', (): void => {
  it('toma sourceTool y toolCategory del adaptador (RF-018)', (): void => {
    const result = normalizeFinding(buildParsedFinding(), semgrepTool);

    expect(result.sourceTool).toBe('Semgrep');
    expect(result.toolCategory).toBe('SAST');
  });

  it('deja solo los 8 campos del contrato aunque lleguen más (NFR-001)', (): void => {
    const findingWithSecrets = {
      ...buildParsedFinding(),
      Secret: 'ghp_falso',
      Match: 'token=ghp_falso',
    } as ParsedFinding;

    const result = normalizeFinding(findingWithSecrets, semgrepTool);

    expect(Object.keys(result).sort()).toEqual([
      'description',
      'filePath',
      'line',
      'recommendation',
      'severity',
      'sourceTool',
      'toolCategory',
      'type',
    ]);
  });

  it('pone severity en null si no es una de las 4 válidas (RF-022)', (): void => {
    const findingWithUnknownSeverity = buildParsedFinding({
      severity: 'ERROR' as unknown as ParsedFinding['severity'],
    });

    expect(normalizeFinding(findingWithUnknownSeverity, semgrepTool).severity).toBeNull();
  });

  it('convierte line 0 o decimal en null', (): void => {
    expect(normalizeFinding(buildParsedFinding({ line: 0 }), semgrepTool).line).toBeNull();
    expect(normalizeFinding(buildParsedFinding({ line: 2.5 }), semgrepTool).line).toBeNull();
  });

  it('usa "/" en las rutas y convierte textos vacíos en null', (): void => {
    const result = normalizeFinding(
      buildParsedFinding({ filePath: 'src\\utils\\unsafe.ts', description: '   ' }),
      semgrepTool,
    );

    expect(result.filePath).toBe('src/utils/unsafe.ts');
    expect(result.description).toBeNull();
  });

  it('lanza InvalidFindingError si falta type', (): void => {
    expect((): unknown =>
      normalizeFinding(buildParsedFinding({ type: '  ' }), semgrepTool),
    ).toThrow(InvalidFindingError);
  });
});
