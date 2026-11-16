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
  it('devuelve solo los adaptadores de las categorías pedidas', (): void => {
    const registry = new AdapterRegistry();
    registry.register(fakeAdapter('Semgrep', 'SAST'));
    registry.register(fakeAdapter('Gitleaks', 'Secret Scanner'));

    const selected = registry.forCategories(['Secret Scanner']);

    expect(selected.map((adapter: ToolAdapter): string => adapter.sourceTool)).toEqual([
      'Gitleaks',
    ]);
  });

  it('rechaza registrar dos veces la misma herramienta', (): void => {
    const registry = new AdapterRegistry();
    registry.register(fakeAdapter('Semgrep', 'SAST'));

    expect((): void => registry.register(fakeAdapter('Semgrep', 'SAST'))).toThrow(
      'ya está registrado',
    );
  });

  it('rechaza una categoría que el backend no acepta', (): void => {
    const registry = new AdapterRegistry();
    const unknownCategoryAdapter = fakeAdapter('Raro', 'DAST' as ToolCategory);

    expect((): void => registry.register(unknownCategoryAdapter)).toThrow('categoría desconocida');
  });
});
