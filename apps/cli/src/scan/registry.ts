import { GitleaksAdapter } from '../adapters/gitleaks/gitleaks-adapter.js';
import {
  isRegistryRulesDisabled,
  resolveRegistryRules,
} from '../adapters/semgrep/registry-rules.js';
import { SemgrepAdapter } from '../adapters/semgrep/semgrep-adapter.js';
import { ExecutionEngine } from '../infra/execution-engine.js';
import { AdapterRegistry } from '../pipeline/adapter-registry.js';

export interface RegistryOptions {
  /** Shared so container detection and downloads happen once per run. */
  engine: ExecutionEngine;
  refreshRules?: boolean;
}

export function buildRegistry(options: RegistryOptions): AdapterRegistry {
  const { engine } = options;
  const registry = new AdapterRegistry();
  registry.register(
    new SemgrepAdapter({
      engine,
      registryRules: (): Promise<string | null> =>
        isRegistryRulesDisabled()
          ? Promise.resolve(null)
          : resolveRegistryRules({ refresh: options.refreshRules, log: engine.settings.log }),
    }),
  );
  registry.register(new GitleaksAdapter({ engine }));
  return registry;
}
