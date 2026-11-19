import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'dist');

// The backend URL is baked in at build time; CODE_SENTINEL_API_URL still overrides it at runtime.
const targetUrl =
  process.env.CODE_SENTINEL_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
try {
  const { protocol } = new URL(targetUrl);
  if (protocol !== 'http:' && protocol !== 'https:') throw new Error(protocol);
} catch {
  console.error(`[build] Invalid backend API URL: ${targetUrl}`);
  process.exit(1);
}
console.log(`[build] Injecting backend API URL during build: ${targetUrl}`);

const endpointConfigPath = resolve(rootDir, 'src/config/endpoint.ts');
mkdirSync(dirname(endpointConfigPath), { recursive: true });
writeFileSync(
  endpointConfigPath,
  `// Auto-generated during build. Do not edit directly.
export const DEFAULT_API_URL: string = process.env.CODE_SENTINEL_API_URL || '${targetUrl.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}';
`,
  'utf8',
);

// Start from an empty dist/ so renamed or deleted modules are never published.
rmSync(distDir, { recursive: true, force: true });

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
  cwd: rootDir,
  stdio: 'inherit',
});

const assets = [
  ['rules', 'dist/rules'],
  ['src/auth/pages', 'dist/auth/pages'],
];
for (const [source, destination] of assets) {
  const sourcePath = resolve(rootDir, source);
  if (existsSync(sourcePath)) {
    cpSync(sourcePath, resolve(rootDir, destination), { recursive: true });
  }
}

try {
  chmodSync(resolve(distDir, 'main.js'), 0o755);
} catch {
  // Platforms without POSIX permissions (Windows) do not need the executable bit.
}

console.log('[build] CLI build completed successfully.');
