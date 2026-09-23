/**
 * Sign in on the style kit (`mockups/SignIn.dc.html`): the wordmark heading,
 * one kit card holding the form, the pink primary, the neutral Google pill,
 * and the error / callback-notice states on kit surfaces with lucide icons --
 * and nothing off-kit left in the rendered markup (no emoji, hex, gradient,
 * `bg-white` or Tailwind palette class), which is what makes it follow the OS
 * theme.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '../LoginScreen';

const actions = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('../../../api/auth/actionService', () => ({
  signIn: actions.signIn,
  signInWithGoogle: actions.signInWithGoogle,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

describe('LoginScreen on the kit', () => {
  it('renders the artboard: wordmark heading, subtitle, one kit card, footer', () => {
    const { container } = render(<LoginScreen />);

    const root = screen.getByTestId('login-screen');
    expect(root).toHaveClass('bg-page');

    const heading = screen.getByRole('heading', { level: 1, name: 'My Love' });
    expect(heading.querySelector('svg')).toHaveClass('text-accent', 'fill-current');
    expect(screen.getByText('My Love')).toHaveClass(
      'font-lora',
      'italic',
      'font-semibold',
      'text-[34px]',
      'text-ink'
    );
    expect(screen.getByText('Welcome back — sign in to continue')).toHaveClass(
      'text-[15px]',
      'text-muted'
    );

    const form = container.querySelector('form')!;
    const card = form.parentElement!;
    expect(card).toHaveClass('rounded-[20px]', 'border-line', 'bg-card', 'shadow-card', 'p-5');
    expect(card).toContainElement(screen.getByTestId('google-signin-button'));

    const submit = screen.getByTestId('submit-button');
    expect(submit).toHaveTextContent('Sign in');
    expect(submit).toHaveClass('bg-fill', 'text-white', 'rounded-full', 'h-12');

    const google = screen.getByTestId('google-signin-button');
    expect(google).toHaveTextContent('Continue with Google');
    expect(google).toHaveClass('bg-card2', 'text-ink', 'rounded-full', 'h-12');
    // No multicolour logo: its brand hex has no kit token.
    expect(google.querySelector('svg')).toBeNull();

    expect(screen.getByText('OR')).toHaveClass('text-muted', 'text-xs', 'font-semibold');
    const contact = screen.getByRole('button', { name: 'Contact admin' });
    expect(contact).toHaveClass('text-accent', 'font-semibold');
    expect(contact.parentElement).toHaveTextContent('Need an account? Contact admin');

    for (const field of [
      screen.getByRole('textbox', { name: 'Email' }),
      screen.getByLabelText('Password'),
    ]) {
      expect(field).toHaveClass('bg-field', 'h-12', 'rounded-[14px]', 'ring-line-strong');
      expect(field).toHaveAttribute('aria-invalid', 'false');
    }

    expectOnKit(container.innerHTML);
  });

  it('shows a validation error in the card on the kit failure surface, with a danger ring', () => {
    const { container } = render(<LoginScreen />);

    fireEvent.submit(container.querySelector('form')!);

    const error = screen.getByTestId('login-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Please enter both email and password');
    expect(error).toHaveClass('bg-dtint', 'text-danger');
    expect(error.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.bg-card')).toContainElement(error);

    // The ring mirrors aria-invalid, as the deleted `.form-input[aria-invalid]`
    // rule did.
    for (const field of [
      screen.getByRole('textbox', { name: 'Email' }),
      screen.getByLabelText('Password'),
    ]) {
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveClass('ring-danger');
      expect(field).not.toHaveClass('ring-line-strong');
    }

    expectOnKit(container.innerHTML);
  });

  it('keeps the mapped credential message and shows a lucide spinner while signing in', async () => {
    let settle!: (value: unknown) => void;
    actions.signIn.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const { container } = render(<LoginScreen />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-pass' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    const submit = screen.getByTestId('submit-button');
    expect(submit).toHaveTextContent('Signing in...');
    expect(submit.querySelector('svg')).toHaveClass('animate-spin');
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeDisabled();

    await act(async () =>
      settle({ error: { message: 'Invalid login credentials' }, session: null })
    );
    expect(screen.getByTestId('login-error')).toHaveTextContent(
      'Invalid email or password. Please try again.'
    );
    expectOnKit(container.innerHTML);
  });

  // DW-197: while the Google redirect is pending nothing else on the screen
  // may start a second, competing action.
  it('disables every other control while the Google redirect is pending', async () => {
    actions.signInWithGoogle.mockReturnValue(new Promise(() => {}));
    render(<LoginScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } });

    await act(async () => fireEvent.click(screen.getByTestId('google-signin-button')));

    expect(screen.getByTestId('google-signin-button')).toHaveTextContent('Redirecting to Google...');
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    const contact = screen.getByRole('button', { name: 'Contact admin' });
    expect(contact).toBeDisabled();
    fireEvent.click(contact);
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });

  it('shows the callback notice on card2 in ink with an icon, and retires it on the next attempt', () => {
    const { container } = render(<LoginScreen callbackOutcome="cancelled" />);

    const notice = screen.getByTestId('login-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveClass('bg-card2', 'text-ink');
    expect(notice.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.bg-card')).toContainElement(notice);
    expectOnKit(container.innerHTML);

    fireEvent.submit(container.querySelector('form')!);
    expect(screen.queryByTestId('login-notice')).not.toBeInTheDocument();
  });
});
