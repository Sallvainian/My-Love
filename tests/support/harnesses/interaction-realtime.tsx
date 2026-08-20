import { LazyMotion, domAnimation } from 'framer-motion';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PokeKissInterface } from '../../../src/components/PokeKissInterface';
import { useAppStore } from '../../../src/stores/useAppStore';

/** Mounts the production store and interaction UI without React dev StrictMode. */
export function mountInteractionRealtimeHarness(userId: string): void {
  useAppStore.setState({ userId });

  const root = document.getElementById('root');
  if (!root) throw new Error('Interaction Realtime harness root is missing');

  createRoot(root).render(
    createElement(
      LazyMotion,
      { features: domAnimation },
      createElement(PokeKissInterface)
    )
  );
}
