import { isToolCategory, type ToolCategory } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';

/** RF-030: catálogo de herramientas. El pipeline no conoce herramientas concretas, solo este registro. */
export class AdapterRegistry {
  private readonly adapters = new Map<string, ToolAdapter>();

  register(adapter: ToolAdapter): void {
    if (adapter.sourceTool.trim() === '') {
      throw new Error('Un adaptador necesita sourceTool');
    }
    if (!isToolCategory(adapter.toolCategory)) {
      throw new Error(
        `${adapter.sourceTool}: categoría desconocida "${String(adapter.toolCategory)}"`,
      );
    }
    if (this.adapters.has(adapter.sourceTool)) {
      throw new Error(`El adaptador ${adapter.sourceTool} ya está registrado`);
    }
    this.adapters.set(adapter.sourceTool, adapter);
  }

  forCategories(categories: readonly ToolCategory[]): ToolAdapter[] {
    return this.list().filter((adapter: ToolAdapter): boolean =>
      categories.includes(adapter.toolCategory),
    );
  }

  list(): ToolAdapter[] {
    return [...this.adapters.values()];
  }
}
