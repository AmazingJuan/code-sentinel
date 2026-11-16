import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 1. Resolve API URL from unified environment variable during build time
// Priority: CODE_SENTINEL_API_URL > fallback localhost
const targetUrl =
  process.env.CODE_SENTINEL_API_URL ||
  process.env.VITE_API_URL ||
  'http://localhost:8000';

console.log(`[build] Injecting backend API URL during build: ${targetUrl}`);

// 2. Generate src/config/endpoint.ts
const endpointConfigPath = resolve(rootDir, 'src/config/endpoint.ts');
mkdirSync(dirname(endpointConfigPath), { recursive: true });

const content = `// Auto-generated during build. Do not edit directly.
export const DEFAULT_API_URL: string =
  process.env.CODE_SENTINEL_API_URL || '${targetUrl}';
`;

writeFileSync(endpointConfigPath, content, 'utf8');

// 3. Run TypeScript compilation
execSync('tsc -p tsconfig.build.json', { cwd: rootDir, stdio: 'inherit' });

// 4. Ensure executable permissions
try {
  execSync('chmod +x dist/main.js', { cwd: rootDir, stdio: 'inherit' });
} catch {
  // Ignore on platforms without chmod
}

console.log('[build] CLI build completed successfully.');

