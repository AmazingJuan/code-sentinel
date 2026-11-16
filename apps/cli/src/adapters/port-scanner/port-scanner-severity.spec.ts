import { describe, expect, it } from 'vitest';

import { mapPortSeverity } from './port-scanner-severity.js';

describe('mapPortSeverity (RF-022)', (): void => {
  it('asigna high a puertos de alto riesgo (telnet, ftp, rdp)', (): void => {
    expect(mapPortSeverity(23)).toBe('high');
    expect(mapPortSeverity(21)).toBe('high');
    expect(mapPortSeverity(3389)).toBe('high');
  });

  it('asigna medium a puertos comunes de servicios/bases de datos', (): void => {
    expect(mapPortSeverity(80)).toBe('medium');
    expect(mapPortSeverity(8080)).toBe('medium');
    expect(mapPortSeverity(3000)).toBe('medium');
    expect(mapPortSeverity(5432)).toBe('medium');
  });

  it('asigna low a otros puertos abiertos desconocidos', (): void => {
    expect(mapPortSeverity(9999)).toBe('low');
    expect(mapPortSeverity(12345)).toBe('low');
  });
});
