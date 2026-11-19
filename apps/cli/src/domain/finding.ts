// Values accepted by the backend (see docs/contracts/scan-contract.md).
const TOOL_CATEGORIES = ['SAST', 'Secret Scanner'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** What an adapter extracts from its tool report, without the tool identity. */
export interface ParsedFinding {
  type: string;
  severity: Severity | null;
  filePath: string | null;
  line: number | null;
  cwe?: string | null;
  commitSha?: string | null;
  codeSnippet?: string | null;
  description: string | null;
  recommendation: string | null;
}

/** Common format sent to the backend in POST /scans/:id/results (RF-017). */
export interface NormalizedFinding extends ParsedFinding {
  toolCategory: ToolCategory;
  sourceTool: string;
}

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

export function isToolCategory(value: unknown): value is ToolCategory {
  return typeof value === 'string' && (TOOL_CATEGORIES as readonly string[]).includes(value);
}
