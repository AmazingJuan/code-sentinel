export interface GitleaksResult {
  RuleID: string;
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn?: number;
  EndColumn?: number;
  Match?: string;
  Secret?: string;
  File: string;
  SymlinkFile?: string;
  Commit?: string;
  Entropy?: number;
  Author?: string;
  Email?: string;
  Date?: string;
  Message?: string;
  Tags?: string[];
  Fingerprint?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isGitleaksReport(value: unknown): value is GitleaksResult[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item: unknown) =>
      isRecord(item) &&
      typeof item.RuleID === 'string' &&
      typeof item.File === 'string' &&
      typeof item.StartLine === 'number',
  );
}
