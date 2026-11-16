import type { Severity } from '../../domain/finding.js';

/**
 * RF-022: Regla documentada para asignar severidad a puertos abiertos detectados.
 * Puertos de servicios administrativos o texto plano sin cifrar reciben mayor prioridad.
 */
const HIGH_RISK_PORTS = new Set([21, 23, 3389]); // Telnet, FTP, RDP
const MEDIUM_RISK_PORTS = new Set([22, 80, 8080, 8443, 3000, 5432, 3306, 6379, 27017]); // HTTP, SSH, DBs

export function mapPortSeverity(port: number): Severity {
  if (HIGH_RISK_PORTS.has(port)) {
    return 'high';
  }
  if (MEDIUM_RISK_PORTS.has(port)) {
    return 'medium';
  }
  return 'low';
}
