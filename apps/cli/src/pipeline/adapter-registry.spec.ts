import { describe, expect, it } from 'vitest';

import type { ToolCategory } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';
import { AdapterRegistry } from './adapter-registry.js';

function fakeAdapter(sourceTool: string, toolCategory: ToolCategory): ToolAdapter {
  return {
    sourceTool,
    toolCategory,
    run: (): Promise<string> => Promise.resolve('[]'),
    parse: (): [] => [],
  };
}

describe('AdapterRegistry', (): void => {
  it('returns only the adapters for requested categories', (): void => {
    const registry = new AdapterRegistry();
    registry.register(fakeAdapter('Semgrep', 'SAST'));
    registry.register(fakeAdapter('Gitleaks', 'Secret Scanner'));
    registry.register(fakeAdapter('CodeSentinel', 'Port Scanner'));

    const selected = registry.forCategories(['Secret Scanner']);

    expect(selected.map((adapter: ToolAdapter): string => adapter.sourceTool)).toEqual([
      'Gitleaks',
    ]);

    const portSelected = registry.forCategories(['Port Scanner']);
    expect(portSelected.map((adapter: ToolAdapter): string => adapter.sourceTool)).toEqual([
      'CodeSentinel',
    ]);
  });

  it('rejects registering the same tool twice', (): void => {
    const registry = new AdapterRegistry();
    registry.register(fakeAdapter('Semgrep', 'SAST'));

    expect((): void => registry.register(fakeAdapter('Semgrep', 'SAST'))).toThrow(
      'is already registered',
    );
  });

  it('rejects a category not supported by the backend', (): void => {
    const registry = new AdapterRegistry();
    const unknownCategoryAdapter = fakeAdapter('Raro', 'DAST' as ToolCategory);

    expect((): void => registry.register(unknownCategoryAdapter)).toThrow('unknown category');
  });
});
