import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { NormalizedFinding } from '../domain/finding.js';
import { enrichFindingsWithLocalCode, projectDirectoryOf } from './local-context.js';

function finding(overrides: Partial<NormalizedFinding>): NormalizedFinding {
  return {
    type: 'no-eval',
    severity: 'high',
    toolCategory: 'SAST',
    sourceTool: 'Semgrep',
    filePath: 'app.js',
    line: 3,
    description: null,
    recommendation: null,
    ...overrides,
  };
}

describe('local scan context', (): void => {
  let root: string;

  beforeEach((): void => {
    root = mkdtempSync(join(tmpdir(), 'cs-local-context-'));
    writeFileSync(join(root, 'app.js'), 'a\nb\neval(x)\nd\ne\nf\n', 'utf8');
  });

  afterEach((): void => {
    rmSync(root, { recursive: true, force: true });
  });

  it('adds a snippet around the finding line and the commit sha', (): void => {
    const [enriched] = enrichFindingsWithLocalCode([finding({})], root, 'abc123');
    expect(enriched.commitSha).toBe('abc123');
    const rows = JSON.parse(enriched.codeSnippet as string) as Array<{
      line: number;
      highlight: boolean;
    }>;
    expect(rows.map((row: { line: number }): number => row.line)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.find((row: { highlight: boolean }): boolean => row.highlight)?.line).toBe(3);
  });

  it('never reads files outside the project', (): void => {
    const [enriched] = enrichFindingsWithLocalCode(
      [finding({ filePath: '../../etc/passwd', line: 1 })],
      root,
      null,
    );
    expect(enriched.codeSnippet).toBeNull();
  });

  it('never attaches snippets to secret findings', (): void => {
    const [enriched] = enrichFindingsWithLocalCode(
      [finding({ toolCategory: 'Secret Scanner', sourceTool: 'Gitleaks' })],
      root,
      null,
    );
    expect(enriched.codeSnippet).toBeNull();
  });

  it('uses the parent directory as project directory for a single file target', (): void => {
    expect(projectDirectoryOf(join(root, 'app.js'))).toBe(root);
    expect(projectDirectoryOf(root)).toBe(root);
  });
});
