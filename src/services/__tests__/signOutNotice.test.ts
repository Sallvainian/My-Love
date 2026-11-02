import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSignOutNotice,
  getSignOutNotice,
  showSignOutNotice,
  subscribeSignOutNotice,
} from '../signOutNotice';

describe('signOutNotice', () => {
  afterEach(() => {
    clearSignOutNotice();
  });

  it('holds no notice until one is shown', () => {
    expect(getSignOutNotice()).toBeNull();
  });

  it('shows a notice and tells subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSignOutNotice(listener);

    showSignOutNotice('Partly signed out');

    expect(getSignOutNotice()).toBe('Partly signed out');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('clears the notice and tells subscribers once', () => {
    showSignOutNotice('Partly signed out');
    const listener = vi.fn();
    const unsubscribe = subscribeSignOutNotice(listener);

    clearSignOutNotice();
    clearSignOutNotice();

    expect(getSignOutNotice()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not notify for the text already shown', () => {
    showSignOutNotice('Partly signed out');
    const listener = vi.fn();
    const unsubscribe = subscribeSignOutNotice(listener);

    showSignOutNotice('Partly signed out');

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops telling a subscriber that unsubscribed', () => {
    const listener = vi.fn();
    subscribeSignOutNotice(listener)();

    showSignOutNotice('Partly signed out');

    expect(listener).not.toHaveBeenCalled();
  });
});
