// Valores que acepta el backend (ver docs/contracts/scan-contract.md).
export const TOOL_CATEGORIES = ['SAST', 'Secret Scanner', 'Port Scanner'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Lo que un adaptador extrae del reporte de su herramienta, sin identidad de herramienta. */
export interface ParsedFinding {
  type: string;
  severity: Severity | null;
  filePath: string | null;
  line: number | null;
  description: string | null;
  recommendation: string | null;
}

/** Formato común que viaja al backend en POST /scans/:id/results (RF-017). */
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
