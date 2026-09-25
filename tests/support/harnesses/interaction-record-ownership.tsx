import { LazyMotion, domAnimation } from 'motion/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  InteractionService,
  type SupabaseInteractionRecord,
} from '../../../src/api/interactionService';
import { PokeKissInterface } from '../../../src/components/PokeKissInterface';
import { useAppStore } from '../../../src/stores/useAppStore';
import '../../../src/index.css';

export type OwnershipSnapshot = {
  userId: string | null;
  authSessionVersion: number;
  interactions: Array<{
    id: string;
    type: string;
    fromUserId: string;
    toUserId: string;
    viewed: boolean;
    createdAt: string;
  }>;
  unviewedCount: number;
  subscriptions: Array<{ userId: string; cleanupCalls: number }>;
};

export type InteractionOwnershipBridge = {
  ready: Promise<void>;
  snapshot: () => OwnershipSnapshot;
  setAuthUser: (userId: string, email?: string) => void;
  setPartnerId: (partnerId: string) => void;
  clearAuth: () => void;
  subscribe: () => Promise<number>;
  dispatch: (index: number, record: SupabaseInteractionRecord) => void;
  dispose: () => void;
};

declare global {
  interface Window {
    __interactionOwnership?: InteractionOwnershipBridge;
  }
}

/** Controls service delivery while keeping the production store and rendered UI. */
export function mountInteractionOwnershipHarness(userId: string, partnerId: string): void {
  const container = document.getElementById('root');
  if (!container) throw new Error('Interaction ownership harness root is missing');
  const originalSubscribe = InteractionService.prototype.subscribeInteractions;
  const originalResolvePartnerId = InteractionService.prototype.resolvePartnerId;
  const originalResolvePartnerLookup = InteractionService.prototype.resolvePartnerLookup;
  let currentPartnerId = partnerId;
  const subscriptions: Array<{
    userId: string;
    cleanupCalls: number;
    callback: (record: SupabaseInteractionRecord) => void;
  }> = [];
  const manualCleanups: Array<() => void> = [];
  let markReady = () => {};
  const ready = new Promise<void>((resolve) => { markReady = resolve; });

  // This page runs with no Supabase session, so the real getPartnerId can only
  // answer null and every record would be refused as "no partner". Supplying
  // the relationship here keeps the production guard under test rather than
  // filtering records, which is what the dispatch comment below forbids.
  InteractionService.prototype.resolvePartnerId = async () => currentPartnerId;

  // The subscription reads the snapshot through the discriminated lookup so it
  // can tell "unlinked" from "the read failed" and refuse to clobber a working
  // value on the latter. Both prototypes have to be supplied here for the same
  // reason as above -- an unpatched one reaches the real client, which has no
  // session on this page. `error` is never produced: this harness models a
  // known relationship, and every test that wants "no partner" sets
  // `currentPartnerId` to null, which is the conclusive `unlinked` answer.
  InteractionService.prototype.resolvePartnerLookup = async () =>
    currentPartnerId
      ? { status: 'linked' as const, partnerId: currentPartnerId }
      : { status: 'unlinked' as const };

  // playwright-utils deviation: HTTP/HAR tools cannot retain a JavaScript subscription callback after retirement.
  InteractionService.prototype.subscribeInteractions = async (owner, callback, onStatusChange) => {
    const subscription = { userId: owner, cleanupCalls: 0, callback };
    subscriptions.push(subscription);
    onStatusChange('SUBSCRIBED');
    markReady();
    return () => { subscription.cleanupCalls += 1; };
  };

  useAppStore.getState().setAuthUser(userId);
  const root = createRoot(container);
  window.__interactionOwnership = {
    ready,
    snapshot: () => {
      const state = useAppStore.getState();
      return {
        userId: state.userId,
        authSessionVersion: state.authSessionVersion,
        interactions: state.interactions.map((record) => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
        })),
        unviewedCount: state.unviewedCount,
        subscriptions: subscriptions.map(({ userId, cleanupCalls }) => ({ userId, cleanupCalls })),
      };
    },
    setAuthUser: (owner, email) => useAppStore.getState().setAuthUser(owner, email),
    // The next subscription's snapshot. Each account has its own partner, and
    // the harness stands in for the lookup the browser cannot perform here.
    setPartnerId: (next) => { currentPartnerId = next; },
    clearAuth: () => useAppStore.getState().clearAuth(),
    subscribe: async () => {
      const index = subscriptions.length;
      manualCleanups.push(await useAppStore.getState().subscribeToInteractions(() => {}));
      return index;
    },
    dispatch: (index, record) => {
      const subscription = subscriptions[index];
      if (!subscription) throw new Error(`Missing interaction subscription ${index}`);
      // Always invoke the retained callback. Filtering here would hide a missing production guard.
      subscription.callback(record);
    },
    dispose: () => {
      try {
        root.unmount();
        manualCleanups.splice(0).forEach((cleanup) => cleanup());
      } finally {
        InteractionService.prototype.subscribeInteractions = originalSubscribe;
        InteractionService.prototype.resolvePartnerId = originalResolvePartnerId;
        InteractionService.prototype.resolvePartnerLookup = originalResolvePartnerLookup;
        delete window.__interactionOwnership;
      }
    },
  };
  root.render(createElement(LazyMotion, { features: domAnimation }, createElement(PokeKissInterface)));
}
