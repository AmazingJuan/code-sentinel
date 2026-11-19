import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UNKNOWN_VERSION = '0.0.0';

/** Reads the version from the package.json that ships next to `dist/`. */
export function getPackageVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
}
