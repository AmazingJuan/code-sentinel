#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runCli } from './cli/run-cli.js';
import { errorMessage } from './domain/errors.js';

/** True when this file is the process entrypoint, including through npm/npx bin symlinks. */
function isRunningAsCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const currentPath = fileURLToPath(import.meta.url);
  if (currentPath === entry) return true;
  try {
    return currentPath === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isRunningAsCli()) {
  // Exit explicitly: idle keep-alive sockets or a closed login server must not delay the exit code.
  runCli(process.argv.slice(2)).then(
    (code: number): never => process.exit(code),
    (error: unknown): never => {
      console.error(`Unexpected error: ${errorMessage(error)}`);
      process.exit(1);
    },
  );
}
