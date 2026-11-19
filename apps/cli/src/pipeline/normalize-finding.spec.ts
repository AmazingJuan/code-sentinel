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
    cwe: 'CWE-95',
    commitSha: null,
    codeSnippet: null,
    description: 'Use of eval allows arbitrary code execution',
    recommendation: null,
    ...overrides,
  };
}

describe('normalizeFinding', (): void => {
  it('takes sourceTool and toolCategory from the adapter (RF-018)', (): void => {
    const result = normalizeFinding(buildParsedFinding(), semgrepTool);

    expect(result.sourceTool).toBe('Semgrep');
    expect(result.toolCategory).toBe('SAST');
  });

  it('keeps only the normalized contract fields even if extra properties are provided (NFR-001)', (): void => {
    const findingWithSecrets = {
      ...buildParsedFinding(),
      Secret: 'ghp_fake',
      Match: 'token=ghp_fake',
    } as ParsedFinding;

    const result = normalizeFinding(findingWithSecrets, semgrepTool);

    expect(Object.keys(result).sort()).toEqual([
      'codeSnippet',
      'commitSha',
      'cwe',
      'description',
      'filePath',
      'line',
      'recommendation',
      'severity',
      'sourceTool',
      'toolCategory',
      'type',
    ]);
    expect(result).not.toHaveProperty('Secret');
    expect(result).not.toHaveProperty('Match');
    expect(result.cwe).toBe('CWE-95');
  });

  it('normalizes and retains cwe, commitSha, and codeSnippet correctly', (): void => {
    const findingWithCwe = buildParsedFinding({
      cwe: '  CWE-798  ',
      commitSha: '  abc1234  ',
      codeSnippet: 'const key = "secret";',
    });

    const result = normalizeFinding(findingWithCwe, semgrepTool);
    expect(result.cwe).toBe('CWE-798');
    expect(result.commitSha).toBe('abc1234');
    expect(result.codeSnippet).toBe('const key = "secret";');

    const findingEmptyCwe = buildParsedFinding({
      cwe: '   ',
      commitSha: '   ',
      codeSnippet: '   ',
    });
    const resultEmpty = normalizeFinding(findingEmptyCwe, semgrepTool);
    expect(resultEmpty.cwe).toBeNull();
    expect(resultEmpty.commitSha).toBeNull();
    expect(resultEmpty.codeSnippet).toBeNull();
  });

  it('sets severity to null if it is not one of the 4 valid values (RF-022)', (): void => {
    const findingWithUnknownSeverity = buildParsedFinding({
      severity: 'ERROR' as unknown as ParsedFinding['severity'],
    });

    expect(normalizeFinding(findingWithUnknownSeverity, semgrepTool).severity).toBeNull();
  });

  it('converts line 0 or decimal to null', (): void => {
    expect(normalizeFinding(buildParsedFinding({ line: 0 }), semgrepTool).line).toBeNull();
    expect(normalizeFinding(buildParsedFinding({ line: 2.5 }), semgrepTool).line).toBeNull();
  });

  it('uses "/" in paths and converts empty strings to null', (): void => {
    const result = normalizeFinding(
      buildParsedFinding({ filePath: 'src\\utils\\unsafe.ts', description: '   ' }),
      semgrepTool,
    );

    expect(result.filePath).toBe('src/utils/unsafe.ts');
    expect(result.description).toBeNull();
  });

  it('throws InvalidFindingError if type is missing', (): void => {
    expect((): unknown =>
      normalizeFinding(buildParsedFinding({ type: '  ' }), semgrepTool),
    ).toThrow(InvalidFindingError);
  });
});
