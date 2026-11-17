import { isToolCategory, type ToolCategory } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';

/** RF-030: Tool catalog registry. The pipeline does not hardcode tools, only references this registry. */
export class AdapterRegistry {
  private readonly adapters = new Map<string, ToolAdapter>();

  register(adapter: ToolAdapter): void {
    if (adapter.sourceTool.trim() === '') {
      throw new Error('An adapter requires sourceTool');
    }
    if (!isToolCategory(adapter.toolCategory)) {
      throw new Error(
        `${adapter.sourceTool}: unknown category "${String(adapter.toolCategory)}"`,
      );
    }
    if (this.adapters.has(adapter.sourceTool)) {
      throw new Error(`Adapter ${adapter.sourceTool} is already registered`);
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
