import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { CommandResult, CommandRunner } from '../../infra/command-runner.js';
import { PortScannerAdapter } from './port-scanner-adapter.js';

class FakeCommandRunner implements CommandRunner {
  receivedArgs: readonly string[] = [];

  constructor(private readonly resultOrError: CommandResult | Error) {}

  run(_command: string, args: readonly string[]): Promise<CommandResult> {
    this.receivedArgs = args;
    return this.resultOrError instanceof Error
      ? Promise.reject(this.resultOrError)
      : Promise.resolve(this.resultOrError);
  }
}

const sampleXmlReport = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<nmaprun scanner="nmap" args="nmap -sT -p 80,8080 -oX - 127.0.0.1">
  <host>
    <address addr="127.0.0.1" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="80">
        <state state="open" reason="syn-ack"/>
        <service name="http" method="table" conf="3"/>
      </port>
      <port protocol="tcp" portid="8080">
        <state state="open" reason="syn-ack"/>
        <service name="http-proxy" method="table" conf="3"/>
      </port>
      <port protocol="tcp" portid="22">
        <state state="closed" reason="conn-refused"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

describe('PortScannerAdapter (RF-013)', (): void => {
  it('executes nmap with TCP connect arguments and XML format', async (): Promise<void> => {
    const runner = new FakeCommandRunner({ exitCode: 0, stdout: sampleXmlReport, stderr: '' });
    const adapter = new PortScannerAdapter({ runner, defaultHost: '127.0.0.1', ports: '80,8080' });

    const rawReport = await adapter.run({ rootPath: '/test/project' });

    expect(runner.receivedArgs).toEqual(['-sT', '-p', '80,8080', '-oX', '-', '127.0.0.1']);
    expect(rawReport).toBe(sampleXmlReport);
  });

  it('parses open ports as normalized findings (RF-016, RF-021, RF-022)', (): void => {
    const adapter = new PortScannerAdapter();
    const findings = adapter.parse(sampleXmlReport);

    expect(findings).toHaveLength(2);
    expect(findings[0]).toEqual({
      type: 'Open Port 80',
      severity: 'medium',
      filePath: null,
      line: null,
      description: 'Port 80/tcp (http) is exposed on 127.0.0.1.',
      recommendation: 'Close the port or restrict access using a firewall.',
    });
    expect(findings[1]).toEqual({
      type: 'Open Port 8080',
      severity: 'medium',
      filePath: null,
      line: null,
      description: 'Port 8080/tcp (http-proxy) is exposed on 127.0.0.1.',
      recommendation: 'Close the port or restrict access using a firewall.',
    });
  });

  it('ignores closed or filtered ports', (): void => {
    const xmlWithClosed = `<?xml version="1.0"?>
    <nmaprun>
      <host>
        <address addr="127.0.0.1"/>
        <ports>
          <port protocol="tcp" portid="22"><state state="closed"/></port>
          <port protocol="tcp" portid="443"><state state="filtered"/></port>
        </ports>
      </host>
    </nmaprun>`;

    const adapter = new PortScannerAdapter();
    const findings = adapter.parse(xmlWithClosed);

    expect(findings).toEqual([]);
  });

  it('throws ReportParseError if report is not valid nmap XML', (): void => {
    const adapter = new PortScannerAdapter();

    expect((): void => {
      adapter.parse('This is not XML');
    }).toThrow(ReportParseError);
  });

  it('throws ToolExecutionError if nmap exits with non-zero code', async (): Promise<void> => {
    const runner = new FakeCommandRunner({
      exitCode: 1,
      stdout: '',
      stderr: 'Failed to resolve hostname',
    });
    const adapter = new PortScannerAdapter({ runner });

    await expect(adapter.run({ rootPath: '/test' })).rejects.toThrow(ToolExecutionError);
  });
});
