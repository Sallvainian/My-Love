/**
 * Sign in on the style kit (`mockups/SignIn.dc.html`): the wordmark heading,
 * one kit card holding the form, the pink primary, the neutral Google pill,
 * and the error / callback-notice states on kit surfaces with lucide icons --
 * and nothing off-kit left in the rendered markup (no emoji, hex, gradient,
 * `bg-white` or Tailwind palette class), which is what makes it follow the OS
 * theme.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
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

/** Submit valid-looking credentials against a sign-in that stays pending until `settle`. */
async function startPendingSignIn(user: UserEvent) {
  let settle!: (value: unknown) => void;
  actions.signIn.mockReturnValue(new Promise((resolve) => (settle = resolve)));
  const { container } = render(<LoginScreen />);

  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'person@example.com');
  await user.type(screen.getByLabelText('Password'), 'wrong-pass');
  await user.click(screen.getByTestId('submit-button'));

  return { container, settle };
}

describe('LoginScreen on the kit', () => {
  it('paints the page and the wordmark heading on the kit', () => {
    render(<LoginScreen />);

    const root = screen.getByTestId('login-screen');
    expect(root).toHaveClass('bg-page');

    const heading = screen.getByRole('heading', { level: 1, name: 'My Love' });
    expect(within(heading).getByTestId('login-heading-icon')).toHaveClass(
      'text-accent',
      'fill-current'
    );
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
  });

  it('holds the form and the Google pill in one kit card', () => {
    render(<LoginScreen />);

    const card = screen.getByTestId('login-card');
    expect(card).toContainElement(screen.getByTestId('login-form'));
    expect(card).toHaveClass('rounded-[20px]', 'border-line', 'bg-card', 'shadow-card', 'p-5');
    expect(card).toContainElement(screen.getByTestId('google-signin-button'));
  });

  it('renders Sign in as the pink primary', () => {
    render(<LoginScreen />);

    const submit = screen.getByTestId('submit-button');
    expect(submit).toHaveTextContent('Sign in');
    expect(submit).toHaveClass('bg-fill', 'text-white', 'rounded-full', 'h-12');
  });

  it('renders Continue with Google as the neutral pill with no brand logo', () => {
    render(<LoginScreen />);

    const google = screen.getByTestId('google-signin-button');
    expect(google).toHaveTextContent('Continue with Google');
    expect(google).toHaveClass('bg-card2', 'text-ink', 'rounded-full', 'h-12');
    // No multicolour logo: its brand hex has no kit token.
    expect(google.innerHTML).not.toMatch(/<svg\b/);
  });

  it('renders the OR divider and the Contact admin footer link', () => {
    render(<LoginScreen />);

    expect(screen.getByText('OR')).toHaveClass('text-muted', 'text-xs', 'font-semibold');
    const contact = screen.getByRole('button', { name: 'Contact admin' });
    expect(contact).toHaveClass('text-accent', 'font-semibold');
    const footer = screen.getByTestId('login-footer');
    expect(footer).toContainElement(contact);
    expect(footer).toHaveTextContent('Need an account? Contact admin');
  });

  it('renders both fields on the kit field surface, not invalid', () => {
    render(<LoginScreen />);

    for (const field of [
      screen.getByRole('textbox', { name: 'Email' }),
      screen.getByLabelText('Password'),
    ]) {
      expect(field).toHaveClass('bg-field', 'h-12', 'rounded-[14px]', 'ring-line-strong');
      expect(field).toHaveAttribute('aria-invalid', 'false');
    }
  });

  it('leaves nothing off-kit in the rendered sign-in markup', () => {
    const { container } = render(<LoginScreen />);

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expectOnKit(container.innerHTML);
  });

  it('shows a validation error in the card on the kit failure surface, with a danger ring', () => {
    const { container } = render(<LoginScreen />);

    fireEvent.submit(screen.getByTestId('login-form')); // raw submit: the submit button is disabled while a field is empty, so no click reaches the empty-fields check

    const error = screen.getByTestId('login-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Please enter both email and password');
    expect(error).toHaveClass('bg-dtint', 'text-danger');
    expect(within(error).getByTestId('login-error-icon')).toBeInTheDocument();
    expect(screen.getByTestId('login-card')).toContainElement(error);

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

  it('shows a lucide spinner and locks the email field while signing in', async () => {
    const user = userEvent.setup();
    await startPendingSignIn(user);

    const submit = screen.getByTestId('submit-button');
    expect(submit).toHaveTextContent('Signing in...');
    expect(within(submit).getByTestId('submit-button-spinner')).toHaveClass('animate-spin');
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeDisabled();
  });

  it('maps invalid credentials to the friendly message on the kit', async () => {
    const user = userEvent.setup();
    const { container, settle } = await startPendingSignIn(user);

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
    const user = userEvent.setup();
    actions.signInWithGoogle.mockReturnValue(new Promise(() => {}));
    render(<LoginScreen />);
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'person@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');

    await user.click(screen.getByTestId('google-signin-button'));

    expect(screen.getByTestId('google-signin-button')).toHaveTextContent('Redirecting to Google...');
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    const contact = screen.getByRole('button', { name: 'Contact admin' });
    expect(contact).toBeDisabled();
    await user.click(contact);
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });

  it('shows the callback notice on card2 in ink with an icon, and retires it on the next attempt', async () => {
    const user = userEvent.setup();
    const { container } = render(<LoginScreen callbackOutcome="cancelled" />);

    const notice = screen.getByTestId('login-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveClass('bg-card2', 'text-ink');
    expect(within(notice).getByTestId('login-notice-icon')).toBeInTheDocument();
    expect(screen.getByTestId('login-card')).toContainElement(notice);
    expectOnKit(container.innerHTML);

    // Natively a valid email, but the component's own check wants a dotted
    // domain: the attempt fails validation and still retires the notice.
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'person@localhost');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('login-error')).toHaveTextContent('Please enter a valid email address');
    expect(screen.queryByTestId('login-notice')).not.toBeInTheDocument();
    expect(actions.signIn).not.toHaveBeenCalled();
  });
});
