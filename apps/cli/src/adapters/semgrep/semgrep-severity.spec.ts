import { describe, expect, it } from 'vitest';

import { mapSemgrepSeverity } from './semgrep-severity.js';

describe('mapSemgrepSeverity (RF-022)', (): void => {
  it('maps Semgrep CE severities to standard levels', (): void => {
    expect(mapSemgrepSeverity('ERROR')).toBe('high');
    expect(mapSemgrepSeverity('WARNING')).toBe('medium');
    expect(mapSemgrepSeverity('INFO')).toBe('low');
  });

  it('accepts normalized severities case-insensitively', (): void => {
    expect(mapSemgrepSeverity('CRITICAL')).toBe('critical');
    expect(mapSemgrepSeverity('medium')).toBe('medium');
  });

  it('returns null if there is no matching severity rule', (): void => {
    expect(mapSemgrepSeverity('INVENTORY')).toBeNull();
    expect(mapSemgrepSeverity(undefined)).toBeNull();
  });
});
