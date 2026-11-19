export class ToolExecutionError extends Error {
  constructor(
    public readonly sourceTool: string,
    detail: string,
  ) {
    super(`${sourceTool} failed to execute: ${detail}`);
    this.name = 'ToolExecutionError';
  }
}

export class ReportParseError extends Error {
  constructor(
    public readonly sourceTool: string,
    detail: string,
  ) {
    super(`${sourceTool} generated an invalid report: ${detail}`);
    this.name = 'ReportParseError';
  }
}

export class InvalidFindingError extends Error {
  constructor(
    public readonly sourceTool: string,
    detail: string,
  ) {
    super(`${sourceTool} produced an invalid finding: ${detail}`);
    this.name = 'InvalidFindingError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
