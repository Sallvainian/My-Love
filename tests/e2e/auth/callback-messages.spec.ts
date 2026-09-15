/**
 * P1 E2E: DW-95 / DW-96 — the two authentication callbacks that used to end on
 * the login screen with nothing to read now say what happened.
 *
 * Both URLs are refused before any network call: the denial fragment throws out
 * of `_getSessionFromURL` at its `error` branch, and the code without a
 * verifier in this browser is never classified as a callback at all. So neither
 * case stubs anything — what is asserted is what the real client does with the
 * real URL.
 *
 * The sibling `implicit-fragment-rejection.spec.ts` pins the third callback,
 * the one that must stay silent; nothing here may give it a voice.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('OAuth callback messages', () => {
  // The login screen is the only surface for these, so the signed-out state is
  // the whole precondition.
  test.use({ authSessionEnabled: false });

  test('[P1] explains a sign-in the provider refused', async ({ page }) => {
    // GIVEN/WHEN: the provider sends the person back having denied the request.
    await page.goto('/#error=access_denied&error_code=403&error_description=Denied');

    // THEN: they land on the login screen with the reason, not in silence.
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByTestId('login-notice')).toBeVisible();
    await expect(page.getByTestId('login-notice')).toContainText('cancelled');
    await expect(page.getByTestId('login-notice')).toContainText('sign in again');
  });

  test('[P1] explains a code callback that belongs to another browser', async ({ page }) => {
    // GIVEN/WHEN: a `?code=` arrives in a browser that holds no verifier for
    // it — the returning-link-opened-elsewhere case.
    await page.goto('/?code=not-for-this-browser');

    // THEN: the login screen names the browser the flow started in.
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByTestId('login-notice')).toBeVisible();
    await expect(page.getByTestId('login-notice')).toContainText('browser you started in');
  });

  test('[P1] shows no notice on an ordinary signed-out load', async ({ page }) => {
    // The control: without it a notice rendered unconditionally would pass both
    // cases above.
    await page.goto('/');

    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByTestId('login-notice')).toHaveCount(0);
  });
});
