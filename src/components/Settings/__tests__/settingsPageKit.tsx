/**
 * Shared by the Settings page tests: opening Settings at a path as a fresh
 * load, and the event rows they seed. Import from here rather than copying
 * (AGENTS.md, shared test helpers); `settingsStackKit.ts` holds the popstate
 * listener and `tests/unit/stores/accountDataFixtures.ts` the `navigator`
 * stubs (`setOnline`, `setConnection`).
 */
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import type { CoupleEvent } from '../../../services/eventsService';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';

/**
 * A fresh load at `/settings/<path>`: no history state, so a page goes up by
 * replacing it. `strict` renders under StrictMode.
 */
export function renderAt(path: string, strict = false) {
  window.history.replaceState(null, '', `/settings/${path}`);
  useAppStore.setState({ settingsPath: path, settingsPushedPath: null });
  render(
    strict ? (
      <StrictMode>
        <Settings />
      </StrictMode>
    ) : (
      <Settings />
    )
  );
}

/** A local date `offset` calendar days from today, at local midnight. */
export function daysFromToday(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

/**
 * An event row: an own upcoming trip ten days out unless `overrides` says
 * otherwise. Pass `userId`; the files keep their own accounts.
 */
export function makeEvent(overrides: Partial<CoupleEvent> & Pick<CoupleEvent, 'userId'>): CoupleEvent {
  return {
    id: 'event-1',
    label: 'Weekend trip',
    date: daysFromToday(10),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    description: 'Bring the camera',
    icon: 'plane',
    ...overrides,
  };
}
