import type { Severity } from '../../domain/finding.js';

/**
 * RF-022: Regla documentada para asignar severidad a secretos detectados.
 * Credenciales de alta privacía (claves privadas, tokens de nube, accesos PAT, JWT)
 * se clasifican como 'critical', mientras que claves API generales se clasifican como 'high'.
 */
const CRITICAL_RULE_PATTERNS = [
  'private-key',
  'rsa',
  'aws',
  'github-pat',
  'gitlab-pat',
  'slack-bot',
  'jwt',
  'password',
  'secret-key',
];

export function mapGitleaksSeverity(ruleId: string): Severity {
  const normalized = ruleId.toLowerCase();
  for (const pattern of CRITICAL_RULE_PATTERNS) {
    if (normalized.includes(pattern)) {
      return 'critical';
    }
  }
  return 'high';
}
