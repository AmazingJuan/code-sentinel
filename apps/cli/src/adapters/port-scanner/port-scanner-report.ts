export interface NmapPortEntry {
  port: number;
  protocol: string;
  state: string;
  service?: string;
}

export interface NmapHostReport {
  target: string;
  ports: NmapPortEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseNmapXmlOutput(xmlContent: string): NmapHostReport[] {
  const reports: NmapHostReport[] = [];

  // Expresión regular para extraer bloques <host>...</host>
  const hostRegex = /<host[\s\S]*?<\/host>/g;
  const hostMatches = xmlContent.match(hostRegex);

  if (!hostMatches) {
    return reports;
  }

  for (const hostBlock of hostMatches) {
    // Extraer dirección IPv4 o hostname
    const addrMatch = hostBlock.match(/<address\s+addr="([^"]+)"/);
    const target = addrMatch ? addrMatch[1] : 'localhost';

    const ports: NmapPortEntry[] = [];
    // Extraer bloques <port protocol="..." portid="...">...</port>
    const portBlockRegex = /<port\s+protocol="([^"]+)"\s+portid="([^"]+)">([\s\S]*?)<\/port>/g;
    let match: RegExpExecArray | null;

    while ((match = portBlockRegex.exec(hostBlock)) !== null) {
      const protocol = match[1];
      const portId = Number.parseInt(match[2], 10);
      const portBody = match[3];

      const stateMatch = portBody.match(/<state\s+state="([^"]+)"/);
      const state = stateMatch ? stateMatch[1] : 'unknown';

      const serviceMatch = portBody.match(/<service\s+name="([^"]+)"/);
      const service = serviceMatch ? serviceMatch[1] : undefined;

      ports.push({
        port: portId,
        protocol,
        state,
        service,
      });
    }

    reports.push({ target, ports });
  }

  return reports;
}

export function isNmapHostReport(value: unknown): value is NmapHostReport {
  return (
    isRecord(value) &&
    typeof value.target === 'string' &&
    Array.isArray(value.ports) &&
    value.ports.every(
      (portEntry: unknown) =>
        isRecord(portEntry) &&
        typeof portEntry.port === 'number' &&
        typeof portEntry.protocol === 'string' &&
        typeof portEntry.state === 'string',
    )
  );
}

