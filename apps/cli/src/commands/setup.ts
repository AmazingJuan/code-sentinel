import { GITLEAKS_TOOL } from '../adapters/gitleaks/gitleaks-adapter.js';
import {
  isRegistryRulesDisabled,
  REGISTRY_RULESET,
  resolveRegistryRules,
} from '../adapters/semgrep/registry-rules.js';
import { SEMGREP_TOOL } from '../adapters/semgrep/semgrep-adapter.js';
import { printBanner } from '../cli/output.js';
import { errorMessage } from '../domain/errors.js';
import type { ExecutionEngine, ToolDefinition } from '../infra/execution-engine.js';
import { findManagedAsset, installManagedTool, MANAGED_TOOLS } from '../infra/managed-tools.js';

/** `code-sentinel setup`: installs the native scanners and warms the rules cache. */
export async function handleSetupCommand(engine: ExecutionEngine): Promise<number> {
  printBanner('Native Scanner Setup');
  let failures = 0;

  const tools: ToolDefinition[] = [SEMGREP_TOOL, GITLEAKS_TOOL];
  for (const tool of tools) {
    try {
      const existing = engine.findLocalBinary(tool);
      if (existing) {
        console.log(` ${tool.sourceTool}: using ${existing}`);
        continue;
      }
      if (!findManagedAsset(tool.managedTool)) {
        console.log(
          ` ${tool.sourceTool}: no prebuilt binary for this platform; Docker will be used.`,
        );
        continue;
      }
      const installed = await installManagedTool(
        tool.managedTool,
        engine.settings.runner,
        engine.settings.log,
      );
      console.log(
        ` ${tool.sourceTool}: installed ${tool.managedTool} v${MANAGED_TOOLS[tool.managedTool].version} (${installed})`,
      );
    } catch (error: unknown) {
      failures++;
      console.error(` ${tool.sourceTool}: setup failed (${errorMessage(error)})`);
    }
  }

  if (isRegistryRulesDisabled()) {
    console.log(
      ` Semgrep ${REGISTRY_RULESET} ruleset disabled by CODE_SENTINEL_SEMGREP_REGISTRY=off.`,
    );
  } else {
    const rulesPath = await resolveRegistryRules({ refresh: true, log: engine.settings.log });
    if (rulesPath) {
      console.log(` Semgrep ${REGISTRY_RULESET} ruleset cached at ${rulesPath}`);
    } else {
      failures++;
    }
  }

  console.log(
    failures === 0 ? ' Setup complete. Scans will run natively.' : ' Setup finished with errors.',
  );
  return failures === 0 ? 0 : 1;
}
