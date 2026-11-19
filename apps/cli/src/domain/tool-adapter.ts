import type { ParsedFinding, ToolCategory } from './finding.js';

export interface ScanTarget {
  /** Absolute path of the directory to scan. */
  rootPath: string;
}

/**
 * Contract for every integrated tool (RF-030, NFR-005). Adding a tool means implementing
 * this interface and registering the adapter.
 */
export interface ToolAdapter {
  readonly sourceTool: string;
  readonly toolCategory: ToolCategory;
  /** Runs the tool locally and returns its raw report (NFR-007). */
  run(target: ScanTarget): Promise<string>;
  /** Parses the raw report into findings (RF-016); throws ReportParseError when invalid. */
  parse(rawReport: string, target: ScanTarget): ParsedFinding[];
}
