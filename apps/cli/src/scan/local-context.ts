import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { NormalizedFinding } from '../domain/finding.js';

export interface GitMetadata {
  commitSha: string | null;
  branch: string | null;
}

const SNIPPET_CONTEXT_LINES = 2;

/** Directory that represents the project for a target that may be a single file. */
export function projectDirectoryOf(targetPath: string): string {
  return statSync(targetPath).isFile() ? dirname(targetPath) : targetPath;
}

function git(args: string[], cwd: string): string | null {
  try {
    const output = execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

export function detectGitMetadata(projectDir: string): GitMetadata {
  const commitSha = git(['rev-parse', 'HEAD'], projectDir);
  if (!commitSha) return { commitSha: null, branch: null };
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], projectDir);
  // A detached HEAD reports the literal "HEAD" instead of a branch name.
  return { commitSha, branch: branch && branch !== 'HEAD' ? branch : null };
}

/**
 * Attaches the commit and a 5-line code snippet to each finding. Secret Scanner findings
 * never get a snippet: the surrounding lines contain the very secret Gitleaks redacts.
 */
export function enrichFindingsWithLocalCode(
  findings: NormalizedFinding[],
  sourceRoot: string,
  commitSha: string | null,
): NormalizedFinding[] {
  // Several findings usually share a file, so each file is read and split once.
  const linesByFile = new Map<string, string[] | null>();
  const readLines = (fullPath: string): string[] | null => {
    if (!linesByFile.has(fullPath)) {
      linesByFile.set(
        fullPath,
        existsSync(fullPath) ? readFileSync(fullPath, 'utf8').split('\n') : null,
      );
    }
    return linesByFile.get(fullPath) ?? null;
  };

  return findings.map((finding: NormalizedFinding): NormalizedFinding => {
    let snippet: string | null = null;
    if (finding.filePath && finding.line && finding.toolCategory !== 'Secret Scanner') {
      try {
        const fullPath = resolve(sourceRoot, finding.filePath);
        // Never read outside the project, even if a report contains ".." paths.
        const relativePath = relative(sourceRoot, fullPath);
        const lines =
          relativePath.startsWith('..') || isAbsolute(relativePath) ? null : readLines(fullPath);
        if (lines) {
          const targetLine = finding.line;
          const startLine = Math.max(1, targetLine - SNIPPET_CONTEXT_LINES);
          const endLine = Math.min(lines.length, targetLine + SNIPPET_CONTEXT_LINES);
          const rows: Array<{ line: number; text: string; highlight: boolean }> = [];
          for (let i = startLine; i <= endLine; i++) {
            rows.push({ line: i, text: lines[i - 1] ?? '', highlight: i === targetLine });
          }
          snippet = JSON.stringify(rows);
        }
      } catch {
        // A snippet is optional context; unreadable files are reported without one.
      }
    }
    return {
      ...finding,
      commitSha: finding.commitSha ?? commitSha,
      codeSnippet: finding.codeSnippet ?? snippet,
    };
  });
}
