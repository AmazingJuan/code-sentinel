import { describe, expect, it } from 'vitest';

import { CliUsageError, normalizeApiUrl, parseCliArgs, parseToolList } from './args.js';

describe('normalizeApiUrl', (): void => {
  it('accepts http(s) URLs and strips trailing slashes', (): void => {
    expect(normalizeApiUrl('https://api.example.com/', '--api-url')).toBe(
      'https://api.example.com',
    );
    expect(normalizeApiUrl('http://localhost:8000/api//', '--api-url')).toBe(
      'http://localhost:8000/api',
    );
  });

  it('rejects non-http schemes, malformed values and query strings', (): void => {
    expect((): string => normalizeApiUrl('ftp://example.com', '--api-url')).toThrow(CliUsageError);
    expect((): string => normalizeApiUrl('not a url', '--api-url')).toThrow(CliUsageError);
    expect((): string => normalizeApiUrl('https://example.com/?x=1', '--api-url')).toThrow(
      CliUsageError,
    );
  });
});

describe('parseToolList', (): void => {
  it('splits and trims a comma-separated list', (): void => {
    expect(parseToolList(' semgrep , gitleaks,')).toEqual(['semgrep', 'gitleaks']);
  });

  it('rejects an empty list', (): void => {
    expect((): string[] => parseToolList(' , ')).toThrow(CliUsageError);
  });
});

describe('parseCliArgs', (): void => {
  it('defaults to the scan command on the current directory', (): void => {
    const options = parseCliArgs([]);
    expect(options.command).toBe('scan');
    expect(options.target).toBe('.');
    expect(options.apiUrl).toBeUndefined();
    expect(options.dryRun).toBe(false);
  });

  it('accepts the scan target as a positional argument', (): void => {
    expect(parseCliArgs(['scan', './src']).target).toBe('./src');
    expect((): unknown => parseCliArgs(['scan', './src', '--target', './lib'])).toThrow(
      CliUsageError,
    );
  });

  it('normalizes the engine and rejects unknown options', (): void => {
    expect(parseCliArgs(['--engine', 'Docker']).engine).toBe('docker');
    expect((): unknown => parseCliArgs(['--engine', 'podman'])).toThrow(/Invalid --engine/);
    expect((): unknown => parseCliArgs(['--unknown-flag'])).toThrow(CliUsageError);
  });
});
