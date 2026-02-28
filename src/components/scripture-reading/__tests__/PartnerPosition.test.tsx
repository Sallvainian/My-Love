/**
 * PartnerPosition Component Tests
 *
 * Story 4.2: AC #2 — Partner Position Indicator
 * Unit tests for the PartnerPosition presentational component.
 *
 * Tests:
 * - view=null renders nothing
 * - view='verse' shows verse message
 * - view='response' shows response message
 * - aria-live="polite" present
 */

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PartnerPosition } from '../reading/PartnerPosition';

describe('PartnerPosition', () => {
  test('[P1] renders nothing when presence.view is null', () => {
    const { container } = render(
      <PartnerPosition
        partnerName="Jordan"
        presence={{ view: null, stepIndex: null, ts: null }}
      />
    );

    // Should render nothing (empty or hidden)
    expect(container.querySelector('[data-testid="partner-position"]')).toBeNull();
  });

  test('[P1] shows "[Name] is reading the verse" when view=verse', () => {
    render(
      <PartnerPosition
        partnerName="Jordan"
        presence={{ view: 'verse', stepIndex: 0, ts: Date.now() }}
      />
    );

    const indicator = screen.getByTestId('partner-position');
    expect(indicator).toBeVisible();
    expect(indicator).toHaveTextContent(/jordan is (?:reading|viewing) the verse/i);
  });

  test('[P1] shows "[Name] is reading the response" when view=response', () => {
    render(
      <PartnerPosition
        partnerName="Jordan"
        presence={{ view: 'response', stepIndex: 0, ts: Date.now() }}
      />
    );

    const indicator = screen.getByTestId('partner-position');
    expect(indicator).toBeVisible();
    expect(indicator).toHaveTextContent(/jordan is (?:reading|viewing) the response/i);
  });

  test('[P1] has aria-live="polite" for screen reader updates', () => {
    render(
      <PartnerPosition
        partnerName="Jordan"
        presence={{ view: 'verse', stepIndex: 0, ts: Date.now() }}
      />
    );

    const indicator = screen.getByTestId('partner-position');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
  });
});
