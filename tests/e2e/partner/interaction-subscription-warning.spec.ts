/**
 * P1 E2E: incoming interaction subscription failure surfacing.
 *
 * Exercises the production Supabase service -> Zustand store -> PokeKissInterface
 * chain while controlling only the Phoenix protocol reply for this channel.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';

test.describe('Interaction Realtime connection status', () => {
  test(
    '[P1] DW-35-E2E-001 should announce a terminal interaction subscription failure and clear it after recovery',
    async ({ page, interactionRealtimeControl, supabaseAdmin }) => {
      const { userId } = await resolveOwnPair(supabaseAdmin);

      await log.step('Mount the authenticated production interaction boundary');
      await interactionRealtimeControl.mount(userId);

      await expect(page.getByTestId('fab-main-button')).toBeVisible();

      await log.step('Wait for the controlled incoming-interactions join to fail');
      await interactionRealtimeControl.waitForFailureInjected();

      const warning = page.getByTestId('interaction-connection-warning');
      await expect(warning).toHaveAttribute('role', 'alert');
      await expect(warning).toContainText(
        'Connection lost. Incoming pokes and kisses may not arrive.'
      );

      await log.step('Release the automatic Realtime rejoin response');
      interactionRealtimeControl.allowRecovery();
      await interactionRealtimeControl.waitForRecoveryForwarded();

      await expect(warning).toBeHidden();
    }
  );
});
