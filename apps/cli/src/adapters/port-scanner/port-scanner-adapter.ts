import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ParsedFinding, ToolCategory } from '../../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../../domain/tool-adapter.js';
import {
  type CommandResult,
  type CommandRunner,
  NodeCommandRunner,
} from '../../infra/command-runner.js';
import { parseNmapXmlOutput } from './port-scanner-report.js';
import { mapPortSeverity } from './port-scanner-severity.js';

export interface PortScannerAdapterOptions {
  runner?: CommandRunner;
  defaultHost?: string;
  ports?: string;
}

/**
 * RF-013: Análisis de red y puertos mediante escáner de puertos (Nmap).
 * Identifica servicios de red expuestos y los normaliza como findings (RF-016, RF-017, RF-018).
 */
export class PortScannerAdapter implements ToolAdapter {
  readonly sourceTool = 'CodeSentinel';
  readonly toolCategory: ToolCategory = 'Port Scanner';

  private readonly runner: CommandRunner;
  private readonly defaultHost: string;
  private readonly ports: string;

  constructor(options: PortScannerAdapterOptions = {}) {
    this.runner = options.runner ?? new NodeCommandRunner();
    this.defaultHost = options.defaultHost ?? '127.0.0.1';
    this.ports = options.ports ?? '21-25,80,443,3000,5432,8080,8443';
  }

  buildArgs(host: string): string[] {
    return ['-sT', '-p', this.ports, '-oX', '-', host];
  }

  async run(target: ScanTarget): Promise<string> {
    const host = this.resolveHost(target);
    const result = await this.execute('nmap', this.buildArgs(host));

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new ToolExecutionError(
        this.sourceTool,
        `exit code ${result.exitCode}: ${detail}`,
      );
    }

    return result.stdout;
  }

  parse(rawReport: string): ParsedFinding[] {
    if (!rawReport.trim().startsWith('<?xml') && !rawReport.includes('<nmaprun')) {
      throw new ReportParseError(this.sourceTool, 'output is not a valid XML report');
    }

    const hostReports = parseNmapXmlOutput(rawReport);

    const findings: ParsedFinding[] = [];

    for (const hostReport of hostReports) {
      for (const portEntry of hostReport.ports) {
        if (portEntry.state === 'open') {
          const serviceName = portEntry.service ? ` (${portEntry.service})` : '';
          findings.push({
            type: `Open Port ${portEntry.port}`,
            severity: mapPortSeverity(portEntry.port),
            filePath: null,
            line: null,
            description: `Port ${portEntry.port}/${portEntry.protocol}${serviceName} is exposed on ${hostReport.target}.`,
            recommendation: 'Close the port or restrict access using a firewall.',
          });
        }
      }
    }

    return findings;
  }

  private resolveHost(target: ScanTarget): string {
    return target.rootPath.startsWith('http') || target.rootPath.startsWith('127.')
      ? target.rootPath
      : this.defaultHost;
  }

  private async execute(command: string, args: string[]): Promise<CommandResult> {
    try {
      return await this.runner.run(command, args);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(this.sourceTool, `failed to execute nmap (${detail})`);
    }
  }
}
