/**
 * Service Worker Type Definitions
 *
 * Extends the ServiceWorkerGlobalScope with proper types
 * for Background Sync API and service worker events.
 */

/// <reference lib="webworker" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Type declaration for service worker global scope
declare const self: ServiceWorkerGlobalScope;

// Background Sync API types
interface SyncEvent extends ExtendableEvent {
  tag: string;
  lastChance: boolean;
}

interface ExtendableEvent extends Event {
  waitUntil(f: Promise<unknown>): void;
}

interface ExtendableMessageEvent extends ExtendableEvent {
  data: unknown;
  origin: string;
  lastEventId: string;
  source: Client | ServiceWorker | MessagePort | null;
  ports: ReadonlyArray<MessagePort>;
}

interface ServiceWorkerGlobalScope {
  addEventListener(
    type: 'sync',
    listener: (event: SyncEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: 'message',
    listener: (event: ExtendableMessageEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: 'activate',
    listener: (event: ExtendableEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  clients: Clients;
  registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
}

// Workbox precaching types
interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

declare module 'workbox-precaching' {
  export function precacheAndRoute(entries: Array<PrecacheEntry | string>): void;
  export function cleanupOutdatedCaches(): void;
}

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  }

  interface Window {
    SyncManager: typeof SyncManager | undefined;
  }

  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }

  interface SyncManager {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  }
}

export {};
