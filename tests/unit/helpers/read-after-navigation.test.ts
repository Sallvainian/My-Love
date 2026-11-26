import { EventEmitter } from 'node:events';
import type { Frame, Page, Request } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  observeReadAfterNavigation,
  ReadAfterNavigationTimeoutError,
} from '../../support/helpers/read-after-navigation';
import { ANNIVERSARIES_READ, DAILY_DAY_READ } from '../../support/helpers/reads';

const ORIGIN = 'http://127.0.0.1:54321';

type FakeResponse = { status: () => number; json: () => Promise<unknown> };

/** A page that replays the events the helper listens to: `framenavigated` and `request`. */
function fakePage() {
  const events = new EventEmitter();
  const mainFrame = {} as Frame;
  const page = {
    mainFrame: () => mainFrame,
    on: (name: string, listener: (...args: unknown[]) => void) => events.on(name, listener),
    off: (name: string, listener: (...args: unknown[]) => void) => events.off(name, listener),
    waitForRequest: (predicate: (request: Request) => boolean, options: { timeout: number }) =>
      new Promise<Request>((resolve, reject) => {
        const onRequest = (request: Request) => {
          if (!predicate(request)) return;
          events.off('request', onRequest);
          clearTimeout(timer);
          resolve(request);
        };
        const timer = setTimeout(() => {
          events.off('request', onRequest);
          const error = new Error('Timeout exceeded while waiting for event "request"');
          error.name = 'TimeoutError';
          reject(error);
        }, options.timeout);
        events.on('request', onRequest);
      }),
  } as unknown as Page;
  return {
    page,
    /** A navigation that loads a document: the main frame's document request, then the commit. */
    navigate: () => {
      events.emit('request', documentRequest(mainFrame));
      events.emit('framenavigated', mainFrame);
    },
    /** A same-document change (`pushState`): `framenavigated` with no document request. */
    pushState: () => events.emit('framenavigated', mainFrame),
    send: (request: Request) => events.emit('request', request),
    listeners: () => events.listenerCount('framenavigated') + events.listenerCount('request'),
  };
}

function documentRequest(frame: Frame): Request {
  return {
    method: () => 'GET',
    url: () => `${ORIGIN}/`,
    isNavigationRequest: () => true,
    frame: () => frame,
  } as unknown as Request;
}

function fakeRequest(
  method: string,
  path: string,
  response: () => Promise<FakeResponse | null>
): Request {
  return {
    method: () => method,
    url: () => `${ORIGIN}${path}?select=*`,
    isNavigationRequest: () => false,
    frame: () => ({}) as Frame,
    response,
  } as unknown as Request;
}

const answer = (status: number, body: unknown) => async (): Promise<FakeResponse> => ({
  status: () => status,
  json: async () => body,
});

describe('observeReadAfterNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores the request the left page sent, cut off unanswered, and returns the loaded page own', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
    });
    const leftPage = vi.fn(async () => null);
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', leftPage));
    fake.navigate();
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', answer(200, [{ label: 'x' }])));

    await expect(observed).resolves.toEqual({ status: 200, responseJson: [{ label: 'x' }] });
    expect(leftPage).not.toHaveBeenCalled();
    expect(fake.listeners()).toBe(0);
  });

  it('does not count a same-document pushState as the navigation', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
    });
    const leftPage = vi.fn(async () => null);
    fake.pushState();
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', leftPage));
    fake.navigate();
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', answer(200, [])));

    await expect(observed).resolves.toEqual({ status: 200, responseJson: [] });
    expect(leftPage).not.toHaveBeenCalled();
  });

  it('matches the method and the path end, so a sibling RPC or a write is not the read', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, { method: 'POST', url: DAILY_DAY_READ });
    fake.navigate();
    fake.send(fakeRequest('GET', '/rest/v1/rpc/get_daily_day', answer(500, 'wrong method')));
    fake.send(fakeRequest('POST', '/rest/v1/rpc/get_daily_day_by_id', answer(500, 'wrong rpc')));
    fake.send(fakeRequest('POST', '/rest/v1/rpc/get_daily_day', answer(200, { state: 'none' })));

    await expect(observed).resolves.toEqual({ status: 200, responseJson: { state: 'none' } });
  });

  it('fails with a named error when the loaded page never sends the request', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
      timeout: 1000,
    });
    const failure = observed.catch((error: unknown) => error);
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', answer(200, [])));
    await vi.advanceTimersByTimeAsync(1000);

    const error = await failure;
    expect(error).toBeInstanceOf(ReadAfterNavigationTimeoutError);
    expect(error).toMatchObject({ name: 'ReadAfterNavigationTimeoutError', stage: 'request' });
    expect(fake.listeners()).toBe(0);
  });

  it('fails with a named error when the loaded page request never settles', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
      timeout: 1000,
    });
    const failure = observed.catch((error: unknown) => error);
    fake.navigate();
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', () => new Promise(() => undefined)));
    await vi.advanceTimersByTimeAsync(1000);

    const error = await failure;
    expect(error).toBeInstanceOf(ReadAfterNavigationTimeoutError);
    expect(error).toMatchObject({ stage: 'response' });
    expect(fake.listeners()).toBe(0);
  });

  it('gives the response its own full budget when the request matched late', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
      timeout: 1000,
    });
    fake.navigate();
    await vi.advanceTimersByTimeAsync(990);
    let answered!: (response: FakeResponse) => void;
    fake.send(
      fakeRequest(
        'GET',
        '/rest/v1/anniversaries',
        () => new Promise<FakeResponse>((resolve) => (answered = resolve))
      )
    );
    await vi.advanceTimersByTimeAsync(500);
    answered({ status: () => 200, json: async () => [] });

    await expect(observed).resolves.toEqual({ status: 200, responseJson: [] });
  });

  it('throws a plain error, not the timeout error, when the loaded page request gets no response', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
    });
    const failure = observed.catch((error: unknown) => error);
    fake.navigate();
    fake.send(fakeRequest('GET', '/rest/v1/anniversaries', async () => null));

    const error = await failure;
    expect(error).not.toBeInstanceOf(ReadAfterNavigationTimeoutError);
    expect(error).toMatchObject({ message: expect.stringContaining('got no response') });
  });

  it('returns a null responseJson for a body that is not JSON, so the status assertion reports it', async () => {
    const fake = fakePage();
    const observed = observeReadAfterNavigation(fake.page, {
      method: 'GET',
      url: ANNIVERSARIES_READ,
    });
    fake.navigate();
    fake.send(
      fakeRequest('GET', '/rest/v1/anniversaries', async () => ({
        status: () => 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }))
    );

    await expect(observed).resolves.toEqual({ status: 502, responseJson: null });
  });

  it('refuses a glob that pins query parameters, which it would not match on', async () => {
    const fake = fakePage();
    await expect(
      observeReadAfterNavigation(fake.page, {
        method: 'GET',
        url: '**/rest/v1/users?select=display_name*',
      })
    ).rejects.toThrow('matches a path glob');
  });
});
