import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getConfigDirectory } from '../../auth/credentials.js';

export const REGISTRY_RULESET = 'p/default';
export const REGISTRY_RULES_URL = 'https://semgrep.dev/c/p/default';
export const REGISTRY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_RULES_BYTES = 30 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

export interface RegistryRulesOptions {
  /** Ignora la caché vigente y vuelve a descargar. */
  refresh?: boolean;
  log?: (message: string) => void;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

type RulesFormat = 'json' | 'yml';

/** Semgrep decide el parser por la extensión, así que la caché la conserva. */
export function registryRulesCachePath(format: RulesFormat = 'json'): string {
  return join(getConfigDirectory(), 'cache', `semgrep-p-default.${format}`);
}

function findCachedRules(): string | null {
  const candidates = (['json', 'yml'] as const)
    .map((format: RulesFormat): string => registryRulesCachePath(format))
    .filter((path: string): boolean => existsSync(path));
  return candidates.length > 0 ? candidates[0] : null;
}

export function isRegistryRulesDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CODE_SENTINEL_SEMGREP_REGISTRY?.trim().toLowerCase() === 'off';
}

/** El registry responde YAML o JSON según el cliente; ambos son configs válidas de Semgrep. */
export function detectRulesFormat(content: string): RulesFormat | null {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('rules:')) return 'yml';
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { rules?: unknown };
      return Array.isArray(parsed.rules) ? 'json' : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Devuelve la ruta local del ruleset `p/default`, descargándolo como mucho una vez por
 * semana. Así Semgrep no baja ni compila el registry en cada corrida y puede ejecutarse
 * sin red. Solo se descargan reglas (YAML o JSON): nunca se envía código del proyecto.
 * Devuelve null si no hay copia disponible; el análisis sigue con las reglas locales.
 */
export async function resolveRegistryRules(
  options: RegistryRulesOptions = {},
): Promise<string | null> {
  const log = options.log ?? ((): void => undefined);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const cachedPath = findCachedRules();

  if (
    cachedPath &&
    !options.refresh &&
    now() - statSync(cachedPath).mtimeMs < REGISTRY_CACHE_TTL_MS
  ) {
    return cachedPath;
  }

  try {
    log(`Updating Semgrep ${REGISTRY_RULESET} ruleset cache...`);
    const response = await fetchImpl(REGISTRY_RULES_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const content = await response.text();
    const format = content.length > MAX_RULES_BYTES ? null : detectRulesFormat(content);
    if (!format) {
      throw new Error('unexpected ruleset format');
    }
    const cachePath = registryRulesCachePath(format);
    mkdirSync(join(cachePath, '..'), { recursive: true });
    const partialPath = `${cachePath}.partial`;
    writeFileSync(partialPath, content, 'utf8');
    renameSync(partialPath, cachePath);
    if (cachedPath && cachedPath !== cachePath) rmSync(cachedPath, { force: true });
    return cachePath;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    if (cachedPath) {
      log(`Could not refresh ${REGISTRY_RULESET} (${detail}); using cached copy.`);
      return cachedPath;
    }
    log(`Could not download ${REGISTRY_RULESET} (${detail}); scanning with bundled rules only.`);
    return null;
  }
}
