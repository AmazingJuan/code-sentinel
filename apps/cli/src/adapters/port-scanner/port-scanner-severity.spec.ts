import { describe, expect, it } from 'vitest';

import { mapPortSeverity } from './port-scanner-severity.js';

describe('mapPortSeverity (RF-022)', (): void => {
  it('assigns high to high-risk ports (telnet, ftp, rdp)', (): void => {
    expect(mapPortSeverity(23)).toBe('high');
    expect(mapPortSeverity(21)).toBe('high');
    expect(mapPortSeverity(3389)).toBe('high');
  });

  it('assigns medium to common service/database ports', (): void => {
    expect(mapPortSeverity(80)).toBe('medium');
    expect(mapPortSeverity(8080)).toBe('medium');
    expect(mapPortSeverity(3000)).toBe('medium');
    expect(mapPortSeverity(5432)).toBe('medium');
  });

  it('assigns low to other open unknown ports', (): void => {
    expect(mapPortSeverity(9999)).toBe('low');
    expect(mapPortSeverity(12345)).toBe('low');
  });
});
