import { InvalidFindingError } from '../domain/errors.js';
import { isSeverity, type NormalizedFinding, type ParsedFinding } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';

type ToolIdentity = Pick<ToolAdapter, 'sourceTool' | 'toolCategory'>;

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanPath(value: string | null | undefined): string | null {
  const text = cleanText(value);
  return text === null ? null : text.replaceAll('\\', '/');
}

function cleanLine(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * RF-017: Converts a parsed finding into the normalized common format.
 * Builds the object field by field: any extra properties (Secret, Match, etc.) are discarded.
 */
export function normalizeFinding(
  parsedFinding: ParsedFinding,
  tool: ToolIdentity,
): NormalizedFinding {
  const type = cleanText(parsedFinding.type);
  if (type === null) {
    throw new InvalidFindingError(tool.sourceTool, 'missing type field');
  }

  return {
    type,
    severity: isSeverity(parsedFinding.severity) ? parsedFinding.severity : null,
    toolCategory: tool.toolCategory,
    sourceTool: tool.sourceTool,
    filePath: cleanPath(parsedFinding.filePath),
    line: cleanLine(parsedFinding.line),
    cwe: cleanText(parsedFinding.cwe),
    commitSha: cleanText(parsedFinding.commitSha),
    codeSnippet:
      typeof parsedFinding.codeSnippet === 'string' && parsedFinding.codeSnippet.trim() !== ''
        ? parsedFinding.codeSnippet
        : null,
    description: cleanText(parsedFinding.description),
    recommendation: cleanText(parsedFinding.recommendation),
  };
}
