import { describe, expect, it } from 'vitest';

import { mapSemgrepSeverity } from './semgrep-severity.js';

describe('mapSemgrepSeverity (RF-022)', (): void => {
  it('traduce las severidades de Semgrep CE', (): void => {
    expect(mapSemgrepSeverity('ERROR')).toBe('high');
    expect(mapSemgrepSeverity('WARNING')).toBe('medium');
    expect(mapSemgrepSeverity('INFO')).toBe('low');
  });

  it('acepta las severidades nuevas y no distingue mayúsculas', (): void => {
    expect(mapSemgrepSeverity('CRITICAL')).toBe('critical');
    expect(mapSemgrepSeverity('medium')).toBe('medium');
  });

  it('devuelve null si no hay regla definida para ese valor', (): void => {
    expect(mapSemgrepSeverity('INVENTORY')).toBeNull();
    expect(mapSemgrepSeverity(undefined)).toBeNull();
  });
});
