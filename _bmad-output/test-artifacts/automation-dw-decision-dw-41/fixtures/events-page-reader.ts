import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import type { TypedSupabaseClient } from '../../../../tests/support/factories';
import type { EventsPage, EventsPagination } from '../../../../src/services/eventsService';

export interface EventsPageReader {
  getEventsPage: (pagination?: EventsPagination | null) => Promise<EventsPage>;
  close: () => Promise<void>;
}

/**
 * Load the real service through Vite, replacing only its environment-owned
 * singleton with an authenticated worker client. No query or paging logic is
 * copied into this fixture. Each test owns and closes its module graph.
 */
export async function createEventsPageReader(
  client: TypedSupabaseClient
): Promise<EventsPageReader> {
  const registryName = `tea-dw41-client-${randomUUID()}`;
  const registryKey = Symbol.for(registryName);
  const registry = globalThis as unknown as Record<symbol, TypedSupabaseClient>;
  registry[registryKey] = client;
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

  const restore = () => {
    delete registry[registryKey];
    if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    else Reflect.deleteProperty(navigator, 'onLine');
  };
  const virtualClient = '\0tea-dw41-supabase-client';
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let injected = false;
  try {
    server = await createServer({
      root: fileURLToPath(new URL('../../../../', import.meta.url)),
      configFile: false,
      mode: 'test',
      appType: 'custom',
      logLevel: 'error',
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [{
        name: 'tea-dw41-inject-worker-client',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === '../api/supabaseClient' && importer?.endsWith('/eventsService.ts')) {
            return virtualClient;
          }
        },
        load(id) {
          if (id === virtualClient) {
            injected = true;
            return `export const supabase = globalThis[Symbol.for('${registryName}')];`;
          }
        },
      }],
    });
    const module = await server.ssrLoadModule('/src/services/eventsService.ts') as {
      eventsService: Pick<EventsPageReader, 'getEventsPage'>;
    };
    if (!injected) throw new Error('Worker Supabase client was not injected into the service');
    return {
      // playwright-utils deviation: the subject is the production service's SDK
      // query serialization; apiRequest would bypass that implementation.
      getEventsPage: module.eventsService.getEventsPage.bind(module.eventsService),
      close: async () => {
        try { await server!.close(); } finally { restore(); }
      },
    };
  } catch (error) {
    try { await server?.close(); } finally { restore(); }
    throw error;
  }
}
