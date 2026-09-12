import type { Page } from '@playwright/test';

export interface EventTransportFailureSnapshot {
  name: string;
  code: string;
  message: string;
  sameCause: boolean;
  originalStack: string | undefined;
  causeStack: string | undefined;
  originalName: string;
  causeName: string | undefined;
  originalMessage: string;
  causeMessage: string | undefined;
  originalCode: string;
  causeCode: string | undefined;
  rejectionCount: number;
}

type ProbeWindow = Window & {
  __DW53_PROBE__?: {
    snapshot: EventTransportFailureSnapshot | null;
    restore: () => void;
  };
};

/**
 * Installs a one-shot query rejection, leaving the service, store and UI real.
 * No HTTP request is made by the injected attempt; retry uses the real backend.
 * playwright-utils deviation: HTTP interception cannot preserve a JavaScript
 * Error object across the SDK's normalization, so inject at the query boundary.
 */
export async function installEventTransportFailure(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const target = window as ProbeWindow;
    if (target.__DW53_PROBE__) throw new Error('DW53 probe is already installed');
    const clientPath = '/src/api/supabaseClient.ts';
    const servicePath = '/src/services/eventsService.ts';
    const factoryPath = '/tests/support/factories/event-transport-error.ts';
    const { supabase } = await import(/* @vite-ignore */ clientPath) as
      typeof import('../../../src/api/supabaseClient');
    const { eventsService, EventWriteError } = await import(/* @vite-ignore */ servicePath) as
      typeof import('../../../src/services/eventsService');
    const { createEventTransportFailure } = await import(/* @vite-ignore */ factoryPath) as
      typeof import('../factories/event-transport-error');
    const original = createEventTransportFailure();
    const originalStack = original.stack;
    const originalFrom = supabase.from;
    const originalCreate = eventsService.createEvent;
    let injected = false;
    let rejectionCount = 0;
    const probe = {
      snapshot: null as EventTransportFailureSnapshot | null,
      restore: () => {
        supabase.from = originalFrom;
        eventsService.createEvent = originalCreate;
        delete target.__DW53_PROBE__;
      },
    };

    supabase.from = function (relation: string) {
      const query = Reflect.apply(originalFrom, supabase, [relation]) as
        ReturnType<typeof originalFrom>;
      if (relation === 'events') {
        const originalInsert = query.insert;
        query.insert = function (...args: Parameters<typeof originalInsert>) {
          const mutation = Reflect.apply(originalInsert, query, args) as
            ReturnType<typeof originalInsert>;
          if (!injected) {
            injected = true;
            mutation.then = (onFulfilled, onRejected) => {
              rejectionCount += 1;
              return Promise.reject(original).then(onFulfilled, onRejected);
            };
          }
          return mutation;
        } as typeof originalInsert;
      }
      return query;
    } as typeof originalFrom;

    eventsService.createEvent = async function (input) {
      try {
        return await originalCreate.call(eventsService, input);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        const cause = error.cause;
        probe.snapshot = {
          name: error.name,
          code: error instanceof EventWriteError ? error.code : '',
          message: error.message,
          sameCause: cause === original,
          originalStack,
          causeStack: cause instanceof Error ? cause.stack : undefined,
          originalName: original.name,
          causeName: cause instanceof Error ? cause.name : undefined,
          originalMessage: original.message,
          causeMessage: cause instanceof Error ? cause.message : undefined,
          originalCode: original.code,
          causeCode: cause instanceof Error && 'code' in cause ? String(cause.code) : undefined,
          rejectionCount,
        };
        throw error;
      }
    };
    target.__DW53_PROBE__ = probe;
  });
}

export async function readEventTransportFailure(
  page: Page
): Promise<EventTransportFailureSnapshot | null> {
  return page.evaluate(() => (window as ProbeWindow).__DW53_PROBE__?.snapshot ?? null);
}

/** Idempotent teardown for success, assertion failures and explicit retry. */
export async function restoreEventTransportFailure(page: Page): Promise<void> {
  await page.evaluate(() => (window as ProbeWindow).__DW53_PROBE__?.restore());
}
