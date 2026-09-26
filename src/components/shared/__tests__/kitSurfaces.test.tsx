/**
 * The surfaces with no artboard of their own, on the style kit: the sync toast
 * in each outcome, the network banner offline / connecting / online, both
 * error boundaries' fallbacks, the welcome splash and the display-name dialog.
 * Each is asserted to wear kit classes and to render nothing off-kit (no emoji,
 * hex, gradient, `bg-white` or Tailwind palette class), which is what lets it
 * follow the OS theme.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, forwardRef, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const network = vi.hoisted(() => ({ isOnline: true, isConnecting: false }));

vi.mock('../../../hooks', () => ({
  useNetworkStatus: () => ({ isOnline: network.isOnline, isConnecting: network.isConnecting }),
}));
vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn() },
}));
vi.mock('../../../api/auth/sessionService', () => ({ getUser: vi.fn() }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MOTION_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'transition',
  'whileHover',
  'whileTap',
  'layout',
]);

/**
 * Every `m.<tag>` renders the plain tag with Motion's own props stripped. One
 * component per tag, cached, so a re-render does not remount the subtree.
 */
vi.mock('motion/react', () => {
  const byTag = new Map<string, ComponentType>();
  const motionFor = (tag: string) => {
    let component = byTag.get(tag);
    if (!component) {
      component = forwardRef<HTMLElement, Record<string, unknown>>(function Motion(
        { children, ...props },
        ref
      ) {
        const rest = Object.fromEntries(
          Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))
        );
        return createElement(tag, { ...rest, ref }, children as ReactNode);
      }) as unknown as ComponentType;
      byTag.set(tag, component);
    }
    return component;
  };
  return {
    m: new Proxy({}, { get: (_target, tag: string) => motionFor(tag) }),
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

import { DisplayNameSetup } from '../../DisplayNameSetup';
import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';
import { ViewErrorBoundary } from '../../ViewErrorBoundary';
import { WelcomeSplash } from '../../WelcomeSplash/WelcomeSplash';
import { NetworkStatusIndicator } from '../NetworkStatusIndicator';
import { SyncToast } from '../SyncToast';

const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|shadow|decoration|caret|accent)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;

/** Nothing in the rendered markup that ignores the kit or the OS theme. */
function expectOnKit(html: string) {
  expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(html).not.toMatch(/gradient|\b(?:from|via|to)-[a-z]/);
  expect(html).not.toMatch(/\bbg-white\b/);
  expect(html).not.toMatch(PALETTE);
  expect(html).not.toMatch(/\bdark:/);
}

/** Throws whatever it is given -- not always an Error, as with `throw 'x'`. */
function Thrower({ error }: { error: unknown }): ReactNode {
  throw error;
}

beforeEach(() => {
  network.isOnline = true;
  network.isConnecting = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

describe('SyncToast on the kit', () => {
  it.each([
    ['success', { successCount: 2, failCount: 0 }, 'text-good', 'Synced 2 pending items'],
    ['partial', { successCount: 1, failCount: 1 }, 'text-accent', 'Synced 1 of 2 items (1 failed)'],
    ['all failed', { successCount: 0, failCount: 3 }, 'text-danger', 'Failed to sync 3 items'],
    ['nothing to sync', { successCount: 0, failCount: 0 }, 'text-muted', 'No pending items to sync'],
  ] as const)('renders %s as a kit card with only the icon coloured', async (_name, result, iconColor, message) => {
    const { container } = render(
      <SyncToast syncResult={result} onDismiss={vi.fn()} autoDismissMs={0} />
    );

    const toast = await screen.findByTestId('sync-toast');
    expect(toast).toHaveClass('bg-card', 'border-line', 'shadow-float', 'rounded-[20px]');
    expect(toast.className).toContain('top-[calc(5rem+env(safe-area-inset-top))]');
    expect(within(toast).getByTestId('sync-toast-icon')).toHaveClass(iconColor);
    const text = screen.getByTestId('sync-toast-message');
    expect(text.textContent).toBe(message);
    expect(text).toHaveClass('text-ink');

    const dismiss = screen.getByRole('button', { name: 'Dismiss notification' });
    expect(dismiss).toHaveClass('h-11', 'w-11', 'rounded-full', 'text-muted');
    expectOnKit(container.innerHTML);
  });
});

describe('NetworkStatusIndicator on the kit', () => {
  it('shows offline as a neutral card2 banner with a muted dot and icon', () => {
    network.isOnline = false;
    const { container } = render(<NetworkStatusIndicator showOnlyWhenOffline />);

    const indicator = screen.getByTestId('network-status-indicator');
    expect(indicator).toHaveAttribute('data-status', 'offline');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-label', expect.stringContaining('Offline'));
    const banner = screen.getByTestId('network-status-banner');
    expect(indicator).toContainElement(banner);
    expect(banner).toHaveClass('bg-card2', 'border-b', 'border-line');
    expect(within(banner).getByTestId('network-status-dot')).toHaveClass('bg-muted');
    expect(within(banner).getByTestId('network-status-icon')).toHaveClass('text-muted');
    const label = screen.getByTestId('network-status-label');
    expect(label).toHaveTextContent('Offline');
    expect(label).toHaveClass('text-ink');
    expectOnKit(container.innerHTML);
  });

  it('shows connecting in accent with a spinning icon', () => {
    network.isOnline = false;
    network.isConnecting = true;
    const { container } = render(<NetworkStatusIndicator showOnlyWhenOffline />);

    const indicator = screen.getByTestId('network-status-indicator');
    expect(indicator).toHaveAttribute('data-status', 'connecting');
    const banner = screen.getByTestId('network-status-banner');
    expect(indicator).toContainElement(banner);
    expect(banner).toHaveClass('bg-card2', 'border-line');
    expect(within(banner).getByTestId('network-status-dot')).toHaveClass('bg-accent');
    expect(within(banner).getByTestId('network-status-icon')).toHaveClass(
      'text-accent',
      'animate-spin'
    );
    expectOnKit(container.innerHTML);
  });

  it('shows online as a compact good dot', () => {
    const { container } = render(<NetworkStatusIndicator />);

    const indicator = screen.getByTestId('network-status-indicator');
    expect(indicator).toHaveAttribute('data-status', 'online');
    expect(within(indicator).getByTestId('network-status-dot')).toHaveClass('bg-good');
    expect(within(indicator).getByTestId('network-status-icon')).toHaveClass('text-good');
    expectOnKit(container.innerHTML);
  });
});

describe('ErrorBoundary fallback on the kit', () => {
  it('renders a kit card with an icon tile and a primary Try Again', () => {
    const { container } = render(
      <ErrorBoundary>
        <Thrower error={new Error('boom')} />
      </ErrorBoundary>
    );

    const title = screen.getByRole('heading', { level: 1, name: 'Something went wrong' });
    expect(title).toHaveClass('text-lg', 'font-semibold', 'text-ink');
    const card = screen.getByTestId('error-boundary-card');
    expect(card).toContainElement(title);
    expect(card).toHaveClass('bg-card', 'border-line', 'shadow-card', 'rounded-[20px]', 'p-5');
    const fallback = screen.getByTestId('error-boundary-fallback');
    expect(fallback).toHaveClass('bg-page');
    expect(fallback).toContainElement(card);
    expect(screen.getByTestId('error-boundary-icon')).toHaveClass(
      'h-10',
      'w-10',
      'rounded-xl',
      'bg-tint',
      'text-accent'
    );
    const message = screen.getByTestId('error-boundary-message');
    expect(message.textContent).toBe('boom');
    expect(message).toHaveClass('bg-card2');
    expect(screen.getByRole('button', { name: 'Try Again' })).toHaveClass('bg-fill');
    expect(screen.queryByRole('button', { name: 'Clear Storage & Reload' })).not.toBeInTheDocument();
    expectOnKit(container.innerHTML);
  });

  it('offers a destructive Clear Storage & Reload for a validation error', () => {
    const { container } = render(
      <ErrorBoundary>
        <Thrower error={new Error('Validation failed: settings')} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Invalid Data Detected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Storage & Reload' })).toHaveClass(
      'bg-dtint',
      'text-danger'
    );
    expectOnKit(container.innerHTML);
  });

  // DW-193: a thrown string or plain object has no `.message`, and the fallback
  // itself used to throw reading it -- with no boundary left above the root one.
  it.each([
    ['a string', 'boom as a string', 'boom as a string'],
    ['a plain object', { reason: 'boom' }, '[object Object]'],
  ])('renders the fallback when a child throws %s', (_label, thrown, shown) => {
    render(
      <ErrorBoundary>
        <Thrower error={thrown} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-message').textContent).toBe(shown);
  });

  // DW-195: a long message scrolls inside its box, left-aligned, instead of
  // pushing the buttons down the page.
  it('bounds the message box and aligns its monospace text left', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error('boom')} />
      </ErrorBoundary>
    );

    const message = screen.getByTestId('error-boundary-message');
    expect(message.textContent).toBe('boom');
    expect(message).toHaveClass('max-h-24', 'overflow-auto', 'text-left');
  });
});

describe('ViewErrorBoundary fallback on the kit', () => {
  function renderViewError(onNavigateHome = vi.fn()) {
    const { container } = render(
      <ViewErrorBoundary viewName="photos" onNavigateHome={onNavigateHome}>
        <Thrower error={new Error('render failed')} />
      </ViewErrorBoundary>
    );
    return { container, onNavigateHome };
  }

  it('renders the view error on a kit card with primary Try Again and secondary Go Home', () => {
    const { container } = renderViewError();

    const fallback = screen.getByTestId('view-error-boundary');
    const card = screen.getByTestId('view-error-card');
    expect(fallback).toContainElement(card);
    expect(card).toHaveClass('bg-card', 'border-line', 'shadow-card', 'rounded-[20px]', 'p-5');
    const icon = screen.getByTestId('view-error-icon');
    expect(card).toContainElement(icon);
    expect(icon).toHaveClass('h-10', 'w-10', 'bg-tint', 'text-accent');
    expect(screen.getByRole('heading', { level: 2, name: 'Error loading photos' })).toHaveClass(
      'text-lg',
      'font-semibold',
      'text-ink'
    );
    const message = screen.getByTestId('view-error-message');
    expect(message.textContent).toBe('render failed');
    expect(message).toHaveClass('bg-card2', 'wrap-break-word');
    expect(screen.getByTestId('error-try-again')).toHaveClass('bg-fill');
    const goHome = screen.getByTestId('error-go-home');
    expect(goHome).toHaveClass('bg-tint', 'text-accent');
    expectOnKit(container.innerHTML);
  });

  it('Go Home on the view error takes the person home', async () => {
    const user = userEvent.setup();
    const { onNavigateHome } = renderViewError();

    await user.click(screen.getByTestId('error-go-home'));
    expect(onNavigateHome).toHaveBeenCalledTimes(1);
  });

  it('renders the offline message for a chunk load failure', () => {
    const { container } = render(
      <ViewErrorBoundary viewName="photos" onNavigateHome={vi.fn()}>
        <Thrower error={new Error('Failed to fetch dynamically imported module')} />
      </ViewErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: "Can't load this page offline" })).toBeInTheDocument();
    expect(screen.queryByTestId('view-error-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('view-error-boundary')).not.toHaveTextContent(
      'Failed to fetch dynamically imported module'
    );
    expectOnKit(container.innerHTML);
  });

  // DW-193, the view-level copy of the same pattern.
  it.each([
    ['a string', 'render failed as a string', 'render failed as a string'],
    ['a plain object', { reason: 'render failed' }, '[object Object]'],
  ])('renders the fallback when a child throws %s', (_label, thrown, shown) => {
    render(
      <ViewErrorBoundary viewName="photos" onNavigateHome={vi.fn()}>
        <Thrower error={thrown} />
      </ViewErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Error loading photos' })).toBeInTheDocument();
    expect(screen.getByTestId('view-error-message').textContent).toBe(shown);
  });
});

describe('WelcomeSplash on the kit', () => {
  function renderSplash(onContinue = vi.fn()) {
    const { container } = render(<WelcomeSplash onContinue={onContinue} />);
    return { container, onContinue };
  }

  it('renders a page ground, lucide heart rain, a kit card and a primary Continue', () => {
    const { container } = renderSplash();

    const splash = screen.getByTestId('welcome-splash');
    expect(splash).toHaveClass('bg-page');
    const heading = screen.getByRole('heading', { level: 1, name: 'Welcome to Your App' });
    expect(heading).toHaveClass('font-serif', 'font-semibold', 'text-[30px]', 'text-ink');
    const card = screen.getByTestId('welcome-card');
    expect(card).toContainElement(heading);
    expect(card).toHaveClass('bg-card', 'border-line', 'shadow-card', 'rounded-[20px]', 'p-5');
    const caption = screen.getByTestId('welcome-caption');
    expect(card).toContainElement(caption);
    expect(caption).toHaveClass('text-[15px]', 'text-ink');

    // 15 falling hearts plus the big one, all lucide and all accent.
    const rain = screen.getByTestId('welcome-heart-rain');
    expect(splash).toContainElement(rain);
    const drops = within(rain).getAllByTestId('welcome-heart-drop');
    expect(drops).toHaveLength(15);
    for (const drop of drops) {
      expect(drop).toHaveClass('text-accent');
      expect(within(drop).getByTestId('welcome-heart-drop-icon')).toBeInstanceOf(SVGSVGElement);
    }

    const continueButton = screen.getByTestId('welcome-continue-button');
    expect(continueButton).toHaveClass('bg-fill', 'text-white', 'rounded-full');
    expect(within(continueButton).getByTestId('welcome-continue-icon')).toBeInTheDocument();
    expectOnKit(container.innerHTML);
  });

  it('Continue on the welcome splash continues once', async () => {
    const user = userEvent.setup();
    const { onContinue } = renderSplash();

    await user.click(screen.getByTestId('welcome-continue-button'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('DisplayNameSetup on the kit', () => {
  it('renders the signup gate as a kit dialog with a full-width primary Continue', () => {
    const { container } = render(<DisplayNameSetup isOpen onComplete={vi.fn()} />);

    expect(screen.getByTestId('display-name-setup')).toHaveClass('bg-black/50', 'fixed');
    const dialog = screen.getByRole('dialog', { name: 'Welcome!' });
    expect(dialog).toHaveClass('bg-card', 'rounded-[20px]', 'max-w-md');
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-lg', 'font-semibold', 'text-ink');
    const subtitle = screen.getByTestId('display-name-subtitle');
    expect(subtitle).toHaveTextContent('What would you like to be called?');
    expect(subtitle).toHaveClass('text-sm', 'text-muted');
    expect(screen.getByLabelText('Display Name')).toHaveClass('bg-field', 'h-12');
    const hint = screen.getByTestId('display-name-hint');
    expect(hint).toHaveTextContent('3-30 characters');
    expect(hint).toHaveClass('text-[13px]', 'text-muted');
    const submit = screen.getByTestId('display-name-submit');
    expect(submit).toHaveClass('bg-fill', 'w-full');
    expect(screen.queryByTestId('display-name-cancel')).not.toBeInTheDocument();
    expectOnKit(container.innerHTML);
  });

  it('renders the edit route with a secondary Cancel and the kit failure box', () => {
    const { container } = render(
      <DisplayNameSetup
        isOpen
        mode="edit"
        initialName="Fr"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('display-name-cancel')).toHaveClass('bg-tint', 'text-accent');
    expect(screen.getByTestId('display-name-submit')).toHaveClass('bg-fill');
    fireEvent.submit(screen.getByTestId('display-name-form')); // raw submit: happy-dom applies minLength to the prefilled 2-char name and blocks a click-driven submit (a browser would not, as the value was never user-edited), so the component's own length check never runs

    const error = screen.getByTestId('display-name-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveClass('bg-dtint', 'text-danger');
    expect(within(error).getByTestId('display-name-error-icon')).toBeInTheDocument();
    expectOnKit(container.innerHTML);
  });
});
