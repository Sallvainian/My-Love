/**
 * Browser integration coverage for DW-75: production authSlice, interaction
 * callbacks, and PokeKissInterface with controlled service callback delivery.
 * Does not exercise the sign-in form, Supabase auth events, or live Realtime.
 */
import { randomUUID } from 'node:crypto';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { createInteractionRecord } from '../../support/factories/interaction-record-ownership';

test.describe('Interaction record ownership', () => {
  // playwright-utils deviation: this browser integration drives real authSlice actions with local identities to retain stale callbacks; no authentication HTTP or HAR traffic exists.
  test.use({ authSessionEnabled: false });

  test(
    '[P0] DW-75-E2E-001 rejects old records while signed out and after the same account returns',
    async ({ page, interactionOwnership }) => {
      const userId = randomUUID();
      const partnerId = randomUUID();
      const existing = createInteractionRecord({ from_user_id: partnerId, to_user_id: userId });
      const current = createInteractionRecord({
        from_user_id: partnerId,
        to_user_id: userId,
        type: 'kiss',
      });
      const badge = page.getByTestId('notification-badge');

      await log.step('Show an interaction from the initial authentication lifetime');
      await interactionOwnership.mount(userId, partnerId);
      await expect(page.getByRole('button', { name: 'Poke' })).toBeVisible();
      await interactionOwnership.dispatch(0, existing);
      const initial = await interactionOwnership.snapshot();
      expect(initial.interactions.map(({ id }) => id)).toEqual([existing.id]);
      expect(initial.unviewedCount).toBe(1);
      expect(initial.subscriptions).toEqual([{ userId, cleanupCalls: 0 }]);
      await expect(badge).toHaveAttribute('aria-label', 'Play 1 unviewed interaction');

      await log.step('Sign out through authSlice and deliver a still-callable old record');
      await interactionOwnership.clearAuth();
      await interactionOwnership.dispatch(
        0,
        createInteractionRecord({ from_user_id: partnerId, to_user_id: userId })
      );
      expect(await interactionOwnership.snapshot()).toMatchObject({
        userId: null,
        authSessionVersion: initial.authSessionVersion + 1,
        interactions: [],
        unviewedCount: 0,
        subscriptions: [{ userId, cleanupCalls: 0 }],
      });
      await expect(badge).toHaveCount(0);

      await log.step('Return to the same account without cleaning up its old callback');
      await interactionOwnership.setAuthUser(userId);
      await interactionOwnership.dispatch(
        0,
        createInteractionRecord({ from_user_id: partnerId, to_user_id: userId })
      );
      expect(await interactionOwnership.snapshot()).toMatchObject({
        userId,
        authSessionVersion: initial.authSessionVersion + 2,
        interactions: [],
        unviewedCount: 0,
        subscriptions: [{ userId, cleanupCalls: 0 }],
      });
      await expect(badge).toHaveCount(0);

      await log.step('Accept the new lifetime record and reject another old delivery');
      const currentSubscription = await interactionOwnership.subscribe();
      expect(currentSubscription).toBe(1);
      await interactionOwnership.dispatch(currentSubscription, current);
      const accepted = await interactionOwnership.snapshot();
      expect(accepted.interactions).toEqual([{
        id: current.id,
        type: 'kiss',
        fromUserId: current.from_user_id,
        toUserId: userId,
        viewed: false,
        createdAt: current.created_at,
      }]);
      expect(accepted.unviewedCount).toBe(1);
      await interactionOwnership.dispatch(
        0,
        createInteractionRecord({ from_user_id: partnerId, to_user_id: userId })
      );
      expect(await interactionOwnership.snapshot()).toEqual(accepted);

      await log.step('Refuse a record from somebody who is not the current partner');
      // The live subscription accepts this account's traffic, so the only thing
      // that can refuse this record is the partner check (CAP-4).
      await interactionOwnership.dispatch(
        currentSubscription,
        createInteractionRecord({ from_user_id: randomUUID(), to_user_id: userId })
      );
      expect(await interactionOwnership.snapshot()).toEqual(accepted);

      await expect(badge).toHaveText('1');
      await expect(badge).toHaveAttribute('aria-label', 'Play 1 unviewed interaction');
    }
  );

  test(
    '[P0] DW-75-E2E-002 keeps the new account badge and store free of the old account records',
    async ({ page, interactionOwnership }) => {
      const userA = randomUUID();
      const userB = randomUUID();
      // A's partner is a third account; B's partner is A. Each account's
      // snapshot is taken when it subscribes.
      const partnerOfA = randomUUID();
      const beforeSwitch = createInteractionRecord({ from_user_id: partnerOfA, to_user_id: userA });
      const current = createInteractionRecord({ from_user_id: userA, to_user_id: userB });
      const badge = page.getByTestId('notification-badge');

      await log.step('Populate account A before switching directly to B');
      await interactionOwnership.mount(userA, partnerOfA);
      await interactionOwnership.dispatch(0, beforeSwitch);
      const initial = await interactionOwnership.snapshot();
      expect(initial.interactions.map(({ id }) => id)).toEqual([beforeSwitch.id]);
      expect(initial.unviewedCount).toBe(1);
      await expect(badge).toHaveAttribute('aria-label', 'Play 1 unviewed interaction');

      await interactionOwnership.setAuthUser(userB);
      await interactionOwnership.setPartnerId(userA);
      await interactionOwnership.dispatch(
        0,
        createInteractionRecord({ from_user_id: partnerOfA, to_user_id: userA })
      );
      expect(await interactionOwnership.snapshot()).toMatchObject({
        userId: userB,
        authSessionVersion: initial.authSessionVersion + 1,
        interactions: [],
        unviewedCount: 0,
        subscriptions: [{ userId: userA, cleanupCalls: 0 }],
      });
      await expect(badge).toHaveCount(0);

      await log.step('Deliver B current record and retain only B data after a late A record');
      const currentSubscription = await interactionOwnership.subscribe();
      expect(currentSubscription).toBe(1);
      await interactionOwnership.dispatch(currentSubscription, current);
      const accepted = await interactionOwnership.snapshot();
      expect(accepted).toEqual({
        userId: userB,
        authSessionVersion: initial.authSessionVersion + 1,
        interactions: [{
          id: current.id,
          type: 'poke',
          fromUserId: userA,
          toUserId: userB,
          viewed: false,
          createdAt: current.created_at,
        }],
        unviewedCount: 1,
        subscriptions: [
          { userId: userA, cleanupCalls: 0 },
          { userId: userB, cleanupCalls: 0 },
        ],
      });
      await interactionOwnership.dispatch(
        0,
        createInteractionRecord({ from_user_id: partnerOfA, to_user_id: userA })
      );
      expect(await interactionOwnership.snapshot()).toEqual(accepted);
      await expect(badge).toHaveText('1');
      await expect(badge).toHaveAttribute('aria-label', 'Play 1 unviewed interaction');
    }
  );

  test(
    '[P1] DW-75-E2E-003 preserves records and delivery through same-user refresh without duplicate counts',
    async ({ page, interactionOwnership }) => {
      const userId = randomUUID();
      const partnerId = randomUUID();
      const existing = createInteractionRecord({ from_user_id: partnerId, to_user_id: userId });
      const fresh = createInteractionRecord({
        from_user_id: partnerId,
        to_user_id: userId,
        type: 'kiss',
        viewed: null,
        created_at: '2026-09-12T03:00:00.000Z',
      });
      const viewed = createInteractionRecord({
        from_user_id: partnerId,
        to_user_id: userId,
        viewed: true,
      });
      const badge = page.getByTestId('notification-badge');

      await log.step('Keep an existing unread interaction across a same-user auth refresh');
      await interactionOwnership.mount(userId, partnerId);
      await interactionOwnership.dispatch(0, existing);
      const initial = await interactionOwnership.snapshot();
      expect(initial.interactions.map(({ id }) => id)).toEqual([existing.id]);
      expect(initial.unviewedCount).toBe(1);
      await expect(badge).toHaveAttribute('aria-label', 'Play 1 unviewed interaction');

      await interactionOwnership.setAuthUser(userId, 'refreshed@example.test');
      expect(await interactionOwnership.snapshot()).toEqual(initial);
      await expect(badge).toHaveText('1');

      await log.step('Deliver a new record and its duplicate through the unchanged callback');
      await interactionOwnership.dispatch(0, fresh);
      const accepted = await interactionOwnership.snapshot();
      expect(accepted.interactions).toEqual([
        {
          id: fresh.id,
          type: 'kiss',
          fromUserId: fresh.from_user_id,
          toUserId: userId,
          viewed: false,
          createdAt: '2026-09-12T03:00:00.000Z',
        },
        ...initial.interactions,
      ]);
      expect(accepted.unviewedCount).toBe(2);
      await interactionOwnership.dispatch(0, fresh);
      expect(await interactionOwnership.snapshot()).toEqual(accepted);
      await expect(badge).toHaveText('2');
      await expect(badge).toHaveAttribute('aria-label', 'Play the oldest of 2 unviewed interactions');

      await log.step('Retain an already-viewed record without increasing the badge');
      await interactionOwnership.dispatch(0, viewed);
      expect(await interactionOwnership.snapshot()).toEqual({
        userId,
        authSessionVersion: initial.authSessionVersion,
        interactions: [
          {
            id: viewed.id,
            type: 'poke',
            fromUserId: viewed.from_user_id,
            toUserId: userId,
            viewed: true,
            createdAt: viewed.created_at,
          },
          ...accepted.interactions,
        ],
        unviewedCount: 2,
        subscriptions: [{ userId, cleanupCalls: 0 }],
      });
      await expect(badge).toHaveText('2');
      await expect(badge).toHaveAttribute('aria-label', 'Play the oldest of 2 unviewed interactions');
    }
  );

  test(
    '[P1] DW-200-E2E-001 plays from a tap outside the visible badge without covering History',
    async ({ page, interactionOwnership }) => {
      const userId = randomUUID();
      const partnerId = randomUUID();
      const badge = page.getByTestId('notification-badge');
      const history = page.getByTestId('history-button');

      await log.step('Show one unviewed interaction');
      await interactionOwnership.mount(userId, partnerId);
      await interactionOwnership.dispatch(
        0,
        createInteractionRecord({ from_user_id: partnerId, to_user_id: userId })
      );
      await expect(badge).toHaveText('1');
      // The badge scales in from 0; measure it only once it is full size.
      await expect.poll(async () => (await badge.boundingBox())?.height).toBe(20);
      const box = (await badge.boundingBox())!;
      const historyBox = (await history.boundingBox())!;
      const centreY = box.y + box.height / 2;

      await log.step('Hit-test the free space right of the badge and History beside it');
      const hits = await page.evaluate(
        ({ right, historyEdge, y }) => {
          const hit = (x: number) =>
            document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid');
          return { right: hit(right), historyEdge: hit(historyEdge) };
        },
        // 2px inside History's edge: the badge's pulse ring reaches 1px past the gap.
        { right: box.x + box.width + 10, historyEdge: historyBox.x + historyBox.width - 2, y: centreY }
      );
      expect(hits).toEqual({ right: 'notification-badge', historyEdge: 'history-button' });

      await log.step('Tap 6px above the visible badge');
      await page.mouse.click(box.x + box.width / 2, box.y - 6);
      await expect(page.getByTestId('poke-animation')).toBeVisible();
    }
  );
});
