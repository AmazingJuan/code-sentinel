import type { ParsedFinding, ToolCategory } from './finding.js';

export interface ScanTarget {
  /** Ruta absoluta de la carpeta del proyecto a escanear. */
  rootPath: string;
}

/**
 * Contrato que cumple toda herramienta integrada (RF-030, NFR-005).
 * Integrar una herramienta nueva = una clase que implemente esto + registrarla.
 */
export interface ToolAdapter {
  readonly sourceTool: string;
  readonly toolCategory: ToolCategory;
  /** Ejecuta la herramienta en local y devuelve su reporte crudo (NFR-007). */
  run(target: ScanTarget): Promise<string>;
  /** Convierte el reporte crudo en findings (RF-016). Lanza ReportParseError si es inválido. */
  parse(rawReport: string, target: ScanTarget): ParsedFinding[];
}
