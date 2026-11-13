export class ToolExecutionError extends Error {
  constructor(
    public readonly sourceTool: string,
    detail: string,
  ) {
    super(`${sourceTool} no se pudo ejecutar: ${detail}`);
    this.name = 'ToolExecutionError';
  }
}

export class ReportParseError extends Error {
  constructor(
    public readonly sourceTool: string,
    detail: string,
  ) {
    super(`${sourceTool} generó un reporte inválido: ${detail}`);
    this.name = 'ReportParseError';
  }
}

export class InvalidFindingError extends Error {
  constructor(
    public readonly sourceTool: string,
    detail: string,
  ) {
    super(`${sourceTool} produjo un finding inválido: ${detail}`);
    this.name = 'InvalidFindingError';
  }
}
