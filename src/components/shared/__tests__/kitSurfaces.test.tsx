/**
 * The surfaces with no artboard of their own, on the style kit: the sync toast
 * in each outcome, the network banner offline / connecting / online, both
 * error boundaries' fallbacks, the welcome splash and the display-name dialog.
 * Each is asserted to wear kit classes and to render nothing off-kit (no emoji,
 * hex, gradient, `bg-white` or Tailwind palette class), which is what lets it
 * follow the OS theme.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
 * Every `m.<tag>` renders the plain tag with framer's own props stripped. One
 * component per tag, cached, so a re-render does not remount the subtree.
 */
vi.mock('framer-motion', () => {
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
  vi.restoreAllMocks();
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
    expect(toast.querySelector('svg')).toHaveClass(iconColor);
    expect(screen.getByText(message)).toHaveClass('text-ink');

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
    const banner = indicator.firstElementChild!;
    expect(banner).toHaveClass('bg-card2', 'border-b', 'border-line');
    expect(banner.querySelector('span')).toHaveClass('bg-muted');
    expect(banner.querySelector('svg')).toHaveClass('text-muted');
    expect(screen.getByText('Offline')).toHaveClass('text-ink');
    expectOnKit(container.innerHTML);
  });

  it('shows connecting in accent with a spinning icon', () => {
    network.isOnline = false;
    network.isConnecting = true;
    const { container } = render(<NetworkStatusIndicator showOnlyWhenOffline />);

    const indicator = screen.getByTestId('network-status-indicator');
    expect(indicator).toHaveAttribute('data-status', 'connecting');
    const banner = indicator.firstElementChild!;
    expect(banner).toHaveClass('bg-card2', 'border-line');
    expect(banner.querySelector('span')).toHaveClass('bg-accent');
    expect(banner.querySelector('svg')).toHaveClass('text-accent', 'animate-spin');
    expectOnKit(container.innerHTML);
  });

  it('shows online as a compact good dot', () => {
    const { container } = render(<NetworkStatusIndicator />);

    const indicator = screen.getByTestId('network-status-indicator');
    expect(indicator).toHaveAttribute('data-status', 'online');
    expect(indicator.querySelector('span')).toHaveClass('bg-good');
    expect(indicator.querySelector('svg')).toHaveClass('text-good');
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
    const card = title.parentElement!;
    expect(card).toHaveClass('bg-card', 'border-line', 'shadow-card', 'rounded-[20px]', 'p-5');
    expect(card.parentElement).toHaveClass('bg-page');
    expect(card.firstElementChild).toHaveClass('h-10', 'w-10', 'rounded-xl', 'bg-tint', 'text-accent');
    expect(screen.getByText('boom')).toHaveClass('bg-card2');
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
    expect(screen.getByText(shown)).toBeInTheDocument();
  });

  // DW-195: a long message scrolls inside its box, left-aligned, instead of
  // pushing the buttons down the page.
  it('bounds the message box and aligns its monospace text left', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error('boom')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('boom')).toHaveClass('max-h-24', 'overflow-auto', 'text-left');
  });
});

describe('ViewErrorBoundary fallback on the kit', () => {
  it('renders the view error on a kit card with primary Try Again and secondary Go Home', () => {
    const onNavigateHome = vi.fn();
    const { container } = render(
      <ViewErrorBoundary viewName="photos" onNavigateHome={onNavigateHome}>
        <Thrower error={new Error('render failed')} />
      </ViewErrorBoundary>
    );

    const fallback = screen.getByTestId('view-error-boundary');
    const card = fallback.firstElementChild!;
    expect(card).toHaveClass('bg-card', 'border-line', 'shadow-card', 'rounded-[20px]', 'p-5');
    expect(card.firstElementChild).toHaveClass('h-10', 'w-10', 'bg-tint', 'text-accent');
    expect(screen.getByRole('heading', { level: 2, name: 'Error loading photos' })).toHaveClass(
      'text-lg',
      'font-semibold',
      'text-ink'
    );
    expect(screen.getByText('render failed')).toHaveClass('bg-card2', 'break-words');
    expect(screen.getByTestId('error-try-again')).toHaveClass('bg-fill');
    const goHome = screen.getByTestId('error-go-home');
    expect(goHome).toHaveClass('bg-tint', 'text-accent');
    fireEvent.click(goHome);
    expect(onNavigateHome).toHaveBeenCalledTimes(1);
    expectOnKit(container.innerHTML);
  });

  it('renders the offline message for a chunk load failure', () => {
    const { container } = render(
      <ViewErrorBoundary viewName="photos" onNavigateHome={vi.fn()}>
        <Thrower error={new Error('Failed to fetch dynamically imported module')} />
      </ViewErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: "Can't load this page offline" })).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch dynamically imported module')).not.toBeInTheDocument();
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
    expect(screen.getByText(shown)).toBeInTheDocument();
  });
});

describe('WelcomeSplash on the kit', () => {
  it('renders a page ground, lucide heart rain, a kit card and a primary Continue', () => {
    const onContinue = vi.fn();
    const { container } = render(<WelcomeSplash onContinue={onContinue} />);

    const splash = screen.getByTestId('welcome-splash');
    expect(splash).toHaveClass('bg-page');
    const heading = screen.getByRole('heading', { level: 1, name: 'Welcome to Your App' });
    expect(heading).toHaveClass('font-serif', 'font-semibold', 'text-[30px]', 'text-ink');
    const card = heading.parentElement!;
    expect(card).toHaveClass('bg-card', 'border-line', 'shadow-card', 'rounded-[20px]', 'p-5');
    expect(heading.nextElementSibling).toHaveClass('text-[15px]', 'text-ink');

    // 15 falling hearts plus the big one, all lucide and all accent.
    const rain = splash.firstElementChild!;
    expect(rain.querySelectorAll('svg')).toHaveLength(15);
    for (const drop of rain.children) expect(drop).toHaveClass('text-accent');

    const continueButton = screen.getByTestId('welcome-continue-button');
    expect(continueButton).toHaveClass('bg-fill', 'text-white', 'rounded-full');
    expect(continueButton.querySelector('svg')).not.toBeNull();
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expectOnKit(container.innerHTML);
  });
});

describe('DisplayNameSetup on the kit', () => {
  it('renders the signup gate as a kit dialog with a full-width primary Continue', () => {
    const { container } = render(<DisplayNameSetup isOpen onComplete={vi.fn()} />);

    expect(screen.getByTestId('display-name-setup')).toHaveClass('bg-black/50', 'fixed');
    const dialog = screen.getByRole('dialog', { name: 'Welcome!' });
    expect(dialog).toHaveClass('bg-card', 'rounded-[20px]', 'max-w-md');
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-lg', 'font-semibold', 'text-ink');
    expect(screen.getByText('What would you like to be called?')).toHaveClass('text-sm', 'text-muted');
    expect(screen.getByLabelText('Display Name')).toHaveClass('bg-field', 'h-12');
    expect(screen.getByText('3-30 characters')).toHaveClass('text-[13px]', 'text-muted');
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
    fireEvent.submit(container.querySelector('form')!);

    const error = screen.getByTestId('display-name-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveClass('bg-dtint', 'text-danger');
    expect(error.querySelector('svg')).not.toBeNull();
    expectOnKit(container.innerHTML);
  });
});
