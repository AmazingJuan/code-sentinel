import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitScanToBackend } from './scan-client.js';

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

function mockBackend(resultsStatus: number): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      if (url.endsWith('/scans'))
        return new Response(JSON.stringify({ id: 'scan-1' }), { status: 201 });
      if (url.endsWith('/results')) {
        return new Response(JSON.stringify({ totalCount: 0, message: 'boom' }), {
          status: resultsStatus,
        });
      }
      return new Response('{}', { status: 200 });
    }),
  );
  return calls;
}

describe('submitScanToBackend', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
  });

  const base = {
    apiUrl: 'http://backend.test',
    token: 'jwt',
    projectId: 'p1',
    tools: ['SAST'],
    findings: [],
  };

  it('closes the scan as failed with no findings when a failure message is given', async (): Promise<void> => {
    const calls = mockBackend(200);
    await submitScanToBackend({ ...base, failureMessage: 'Semgrep failed to execute' });
    const results = calls.find((call: Call): boolean => call.url.endsWith('/results'));
    expect(results?.body).toMatchObject({
      status: 'failed',
      errorMessage: 'Semgrep failed to execute',
      findings: [],
    });
  });

  it('marks the scan as failed when the results upload is rejected', async (): Promise<void> => {
    const calls = mockBackend(500);
    await expect(submitScanToBackend(base)).rejects.toThrow(/HTTP 500\): boom/);
    const statusUpdates = calls
      .filter((call: Call): boolean => call.url.endsWith('/status'))
      .map((call: Call): unknown => call.body.status);
    expect(statusUpdates).toEqual(['running', 'failed']);
  });
});
