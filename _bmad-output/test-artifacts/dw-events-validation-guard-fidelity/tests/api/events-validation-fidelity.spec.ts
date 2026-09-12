/**
 * EVG API additions for dw-events-validation-guard-fidelity.
 * Run through the existing Playwright api project after artifact staging.
 *
 * Authority: public.events migration, the tagged EV-DB-037 contract, generated
 * database types, and measured PostgREST shapes in events-wire-contract.spec.ts.
 * POST/PATCH use return=representation; GET checks committed row state.
 * Existing DE.5-API-006 owns POST label 100/101, so it is not repeated here.
 * ASCII fixtures intentionally leave the existing Unicode counting gap to DW-83.
 * coupleEvents owns worker-pair cleanup even when a request/assertion fails.
 */
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import { test, expect } from '../support/merged-fixtures';
import {
  boundaryText,
  EventRowSchema,
  validationContract,
  validationEvent,
} from '../support/factories/events-validation';

const EventRowsSchema = z.array(EventRowSchema);
const PostgrestErrorSchema = z.object({
  code: z.string(),
  details: z.string().nullable(),
  hint: z.string().nullable(),
  message: z.string(),
});
type EventRows = z.infer<typeof EventRowsSchema>;
type PostgrestError = z.infer<typeof PostgrestErrorSchema>;

const lengthCases = [
  { field: 'label', limit: validationContract.labelMaxLength },
  { field: 'description', limit: validationContract.descriptionMaxLength },
] as const;

test.describe('Events validation contract over PostgREST', () => {
  test('[P1] EVG-API-001 description POST accepts the exact limit and rejects one more without insertion', async ({
    apiRequest,
    authToken,
    coupleEvents,
  }) => {
    // GIVEN an authenticated creator and a description at the shared limit.
    const description = boundaryText(validationContract.descriptionMaxLength);
    const acceptedInput = validationEvent(coupleEvents.userId, coupleEvents.anchor, { description });
    const rejectedInput = validationEvent(coupleEvents.userId, coupleEvents.anchor, {
      description: `${description}x`,
    });
    const headers = { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' };

    await log.step('POST the exact description limit as the positive control');
    const accepted = await apiRequest({
      method: 'POST', path: '/rest/v1/events', headers, body: acceptedInput,
    }).validateSchema<EventRows>(EventRowsSchema);
    expect(accepted.status).toBe(201);
    expect(accepted.body).toEqual([expect.objectContaining(acceptedInput)]);

    // WHEN the same owner submits one character beyond the description limit.
    await log.step('POST one character beyond the description limit');
    const refused = await apiRequest({
      method: 'POST', path: '/rest/v1/events', headers, body: rejectedInput,
    }).validateSchema<PostgrestError>(PostgrestErrorSchema);

    // THEN the description CHECK refuses it and only the accepted row exists.
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('23514');
    expect(refused.body.message).toContain('events_description_check');
    const stored = await apiRequest({
      method: 'GET',
      path: `/rest/v1/events?select=*&id=in.(${acceptedInput.id},${rejectedInput.id})`,
      headers,
    }).validateSchema<EventRows>(EventRowsSchema);
    expect(stored.status).toBe(200);
    expect(stored.body).toEqual(accepted.body);
  });

  for (const { field, limit } of lengthCases) {
    test(`[P1] EVG-API-002-${field} PATCH accepts the exact limit and preserves the saved row after rejecting one more`, async ({
      apiRequest,
      authToken,
      coupleEvents,
    }) => {
      // GIVEN one valid creator-owned row and an exact boundary update.
      const input = validationEvent(coupleEvents.userId, coupleEvents.anchor);
      const boundary = boundaryText(limit);
      const headers = { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' };
      const path = `/rest/v1/events?select=*&id=eq.${input.id}`;
      const created = await apiRequest({
        method: 'POST', path: '/rest/v1/events', headers, body: input,
      }).validateSchema<EventRows>(EventRowsSchema);
      expect(created.status).toBe(201);
      expect(created.body).toEqual([expect.objectContaining(input)]);

      await log.step(`PATCH ${field} to the exact shared limit`);
      const saved = await apiRequest({
        method: 'PATCH', path, headers, body: { [field]: boundary },
      }).validateSchema<EventRows>(EventRowsSchema);
      expect(saved.status).toBe(200);
      expect(saved.body).toEqual([{ ...created.body[0], [field]: boundary }]);

      // WHEN a later edit exceeds that same limit by one character.
      await log.step(`PATCH ${field} beyond the limit`);
      const refused = await apiRequest({
        method: 'PATCH', path, headers, body: { [field]: `${boundary}x` },
      }).validateSchema<PostgrestError>(PostgrestErrorSchema);

      // THEN the CHECK rejects the edit and an independent GET retains the row.
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('23514');
      expect(refused.body.message).toContain(`events_${field}_check`);
      const stored = await apiRequest({ method: 'GET', path, headers })
        .validateSchema<EventRows>(EventRowsSchema);
      expect(stored.status).toBe(200);
      expect(stored.body).toEqual(saved.body);
    });
  }

  for (const icon of validationContract.icons) {
    test(`[P2] EVG-API-003-${icon} preserves the complete allowed icon through POST and GET`, async ({
      apiRequest,
      authToken,
      coupleEvents,
    }) => {
      // GIVEN an exact icon literal from the same contract the guard reads.
      const input = validationEvent(coupleEvents.userId, coupleEvents.anchor, { icon });
      const headers = { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' };

      // WHEN the authenticated creator posts the event.
      await log.step(`POST the complete allowed icon: ${icon}`);
      const created = await apiRequest({
        method: 'POST', path: '/rest/v1/events', headers, body: input,
      }).validateSchema<EventRows>(EventRowsSchema);
      expect(created.status).toBe(201);
      expect(created.body).toEqual([expect.objectContaining(input)]);
      expect(created.body[0].icon).toBe(icon);

      // THEN the committed row still contains that exact string.
      const stored = await apiRequest({
        method: 'GET', path: `/rest/v1/events?select=*&id=eq.${input.id}`, headers,
      }).validateSchema<EventRows>(EventRowsSchema);
      expect(stored.status).toBe(200);
      expect(stored.body).toEqual(created.body);
    });
  }

  test('[P2] EVG-API-004 an unknown full icon is rejected without changing the saved row', async ({
    apiRequest,
    authToken,
    coupleEvents,
  }) => {
    // GIVEN a valid saved row and an icon outside the shared contract.
    const unsupportedIcon = 'party-hat';
    expect(validationContract.icons).not.toContain(unsupportedIcon);
    const input = validationEvent(coupleEvents.userId, coupleEvents.anchor, {
      icon: validationContract.icons[0],
    });
    const headers = { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' };
    const path = `/rest/v1/events?select=*&id=eq.${input.id}`;
    const created = await apiRequest({
      method: 'POST', path: '/rest/v1/events', headers, body: input,
    }).validateSchema<EventRows>(EventRowsSchema);
    expect(created.status).toBe(201);
    expect(created.body).toEqual([expect.objectContaining(input)]);

    // WHEN the creator attempts to replace the icon with the whole unknown value.
    await log.step('PATCH an unsupported icon containing punctuation');
    const refused = await apiRequest({
      method: 'PATCH', path, headers, body: { icon: unsupportedIcon },
    }).validateSchema<PostgrestError>(PostgrestErrorSchema);

    // THEN the icon CHECK refuses it and preserves every saved field.
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('23514');
    expect(refused.body.message).toContain('events_icon_check');
    const stored = await apiRequest({ method: 'GET', path, headers })
      .validateSchema<EventRows>(EventRowsSchema);
    expect(stored.status).toBe(200);
    expect(stored.body).toEqual(created.body);
  });
});
