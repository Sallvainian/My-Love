/**
 * Worker-auth fixture
 *
 * Provides worker-isolated storage state paths so parallel workers do not
 * share the same authenticated user/session data.
 *
 * Exposes both primary user and partner user storage states, enabling
 * genuine two-user E2E tests (e.g. together-mode lobby).
 */
import { test as base } from '@playwright/test';
import { existsSync } from 'fs';
import { cpus } from 'os';
import { resolve } from 'path';

const MIN_AUTH_POOL_SIZE = 8;

function getAuthPoolSize(): number {
  const cpuCount = cpus().length;
  const defaultAuthPoolSize = Number.isFinite(cpuCount)
    ? Math.max(MIN_AUTH_POOL_SIZE, cpuCount)
    : MIN_AUTH_POOL_SIZE;

  const raw = process.env.PLAYWRIGHT_AUTH_POOL_SIZE;
  if (!raw) return defaultAuthPoolSize;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultAuthPoolSize;
  }

  return parsed;
}

function getWorkerAuthPath(workerIndex: number): string {
  const poolSize = getAuthPoolSize();
  const normalizedWorkerIndex = ((workerIndex % poolSize) + poolSize) % poolSize;
  return resolve(process.cwd(), 'tests', '.auth', `worker-${normalizedWorkerIndex}.json`);
}

function getWorkerPartnerAuthPath(workerIndex: number): string {
  const poolSize = getAuthPoolSize();
  const normalizedWorkerIndex = ((workerIndex % poolSize) + poolSize) % poolSize;
  return resolve(process.cwd(), 'tests', '.auth', `worker-${normalizedWorkerIndex}-partner.json`);
}

type WorkerAuthFixture = {
  workerStorageStatePath: string;
  partnerStorageStatePath: string;
};

export const test = base.extend<WorkerAuthFixture>({
  workerStorageStatePath: [
    async ({}, use, workerInfo) => {
      const authPath = getWorkerAuthPath(workerInfo.workerIndex);
      if (!existsSync(authPath)) {
        throw new Error(
          `[worker-auth] Missing storage state file: ${authPath}. ` +
            'Run the setup project to generate worker auth states.'
        );
      }
      await use(authPath);
    },
    { scope: 'worker' },
  ],

  partnerStorageStatePath: [
    async ({}, use, workerInfo) => {
      const authPath = getWorkerPartnerAuthPath(workerInfo.workerIndex);
      if (!existsSync(authPath)) {
        throw new Error(
          `[worker-auth] Missing partner storage state file: ${authPath}. ` +
            'Run the setup project to generate worker auth states.'
        );
      }
      await use(authPath);
    },
    { scope: 'worker' },
  ],

  storageState: async ({ workerStorageStatePath }, use) => {
    await use(workerStorageStatePath);
  },
});
