/**
 * Helpers for unit tests that run a `scripts/*.mjs` provisioning script the way
 * `fnox exec` does: as a plain `node` child process with an explicit
 * environment, talking to a stand-in HTTP server in the test's own process.
 */
import { spawn } from 'node:child_process';
import type { IncomingMessage } from 'node:http';

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });
}

/**
 * Runs `script` with `node` and resolves its exit status and combined
 * stdout/stderr.
 *
 * The environment is built from scratch so a real password or service key in
 * the developer's shell can never leak into the run. Only the non-secret
 * variables Node itself needs pass through (Windows networking requires
 * SYSTEMROOT). The child is spawned asynchronously: a blocking spawnSync would
 * freeze this worker's event loop and a stub server in this process could
 * never answer it.
 */
export function runNodeScript(
  script: string,
  env: Record<string, string>
): Promise<{ status: number | null; output: string }> {
  const passthrough: Record<string, string> = {};
  for (const name of ['PATH', 'SYSTEMROOT', 'TEMP', 'TMP']) {
    const value = process.env[name];
    if (value !== undefined) passthrough[name] = value;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: { ...passthrough, ...env },
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}
