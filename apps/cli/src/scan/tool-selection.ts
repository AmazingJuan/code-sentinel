import type { ToolAdapter } from '../domain/tool-adapter.js';

function canonical(value: string): string {
  return value.toLowerCase().trim().replace(/[-_ ]/g, '');
}

/**
 * Matches an adapter against user or project tool selectors. Selectors may be tool names
 * (`semgrep`), backend categories (`SAST`, `Secret Scanner`), loose variants
 * (`secrets`, `secret-scanner`) or `all`.
 */
export function isAdapterSelected(adapter: ToolAdapter, toolPatterns: readonly string[]): boolean {
  if (toolPatterns.some((pattern: string): boolean => canonical(pattern) === 'all')) {
    return true;
  }

  const name = canonical(adapter.sourceTool);
  const category = canonical(adapter.toolCategory);

  return toolPatterns.some((pattern: string): boolean => {
    const p = canonical(pattern);
    if (!p) return false;
    return (
      name.includes(p) ||
      category.includes(p) ||
      p.includes(name) ||
      p.includes(category) ||
      (p.includes('secret') && category.includes('secret')) ||
      (p.includes('sast') && category.includes('sast'))
    );
  });
}
