import type { Severity } from '../../domain/finding.js';

/**
 * RF-022: documented severity rule for detected secrets. Highly privileged credentials
 * (private keys, cloud tokens, PATs, JWTs, passwords) are 'critical'; any other secret is 'high'.
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
