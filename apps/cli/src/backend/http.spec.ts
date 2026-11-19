import { describe, expect, it } from 'vitest';

import { redactUrl, sanitizeErrorDetail } from './http.js';

describe('sanitizeErrorDetail', (): void => {
  it('keeps the NestJS validation message', (): void => {
    const body = JSON.stringify({
      statusCode: 400,
      message: ['tools must be valid', 'x is required'],
    });
    expect(sanitizeErrorDetail(body)).toBe('tools must be valid; x is required');
  });

  it('masks bearer tokens and JWTs echoed by the backend', (): void => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    const detail = sanitizeErrorDetail(`invalid header Authorization: Bearer abc.def and ${jwt}`);
    expect(detail).not.toContain('abc.def');
    expect(detail).not.toContain(jwt);
    expect(detail).toContain('Bearer [REDACTED]');
  });

  it('truncates long bodies such as HTML error pages', (): void => {
    const detail = sanitizeErrorDetail(`<html>${'x'.repeat(5000)}</html>`);
    expect(detail.length).toBeLessThanOrEqual(303);
    expect(detail.endsWith('...')).toBe(true);
  });
});

describe('redactUrl', (): void => {
  it('drops credentials and query strings', (): void => {
    expect(redactUrl('https://user:pass@api.example.com/scans?token=1')).toBe(
      'https://api.example.com/scans',
    );
  });
});
