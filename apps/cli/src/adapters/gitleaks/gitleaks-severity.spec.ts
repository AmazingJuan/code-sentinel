import { describe, expect, it } from 'vitest';

import { mapGitleaksSeverity } from './gitleaks-severity.js';

describe('mapGitleaksSeverity', (): void => {
  it('assigns critical severity to high-risk credentials like PATs and private keys', (): void => {
    expect(mapGitleaksSeverity('github-pat')).toBe('critical');
    expect(mapGitleaksSeverity('aws-access-token')).toBe('critical');
    expect(mapGitleaksSeverity('rsa-private-key')).toBe('critical');
    expect(mapGitleaksSeverity('jwt-secret-key')).toBe('critical');
  });

  it('assigns high severity to generic secrets or tokens', (): void => {
    expect(mapGitleaksSeverity('generic-api-key')).toBe('high');
    expect(mapGitleaksSeverity('stripe-publishable-key')).toBe('high');
  });
});
