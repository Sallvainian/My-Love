/**
 * RoleIndicator Component Tests
 *
 * Story 4.2: AC #1 — Role Indicator Pill Badge
 * Unit tests for the RoleIndicator presentational component.
 *
 * Tests:
 * - Reader renders #A855F7 background and "You read this"
 * - Responder renders #C084FC background and "Partner reads this"
 * - Correct aria-label for both roles
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { RoleIndicator } from '../reading/RoleIndicator';

describe('RoleIndicator', () => {
  test('[P1] renders "You read this" with reader color when role=reader', () => {
    render(<RoleIndicator role="reader" />);

    const pill = screen.getByTestId('role-indicator');
    expect(pill).toBeVisible();
    expect(pill).toHaveTextContent('You read this');
    // Verify reader purple color (#A855F7)
    expect(pill).toHaveStyle({ backgroundColor: '#A855F7' });
  });

  test('[P1] renders "Partner reads this" with responder color when role=responder', () => {
    render(<RoleIndicator role="responder" />);

    const pill = screen.getByTestId('role-indicator');
    expect(pill).toBeVisible();
    expect(pill).toHaveTextContent('Partner reads this');
    // Verify responder lighter purple (#C084FC)
    expect(pill).toHaveStyle({ backgroundColor: '#C084FC' });
  });

  test('[P1] has correct aria-label for reader role', () => {
    render(<RoleIndicator role="reader" />);

    const pill = screen.getByTestId('role-indicator');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('reader'));
  });

  test('[P1] has correct aria-label for responder role', () => {
    render(<RoleIndicator role="responder" />);

    const pill = screen.getByTestId('role-indicator');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('responder'));
  });
});
