/**
 * SwitchRow — the general switch row extracted from Settings' mobile-data
 * row: its ids, accessible name and description, state and keyboard use.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Signal } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SwitchRow } from '../SwitchRow';

function renderRow(overrides: Partial<Parameters<typeof SwitchRow>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <SwitchRow
      id="demo-row"
      icon={Signal}
      label="Demo label"
      helper="Demo helper."
      checked={false}
      onChange={onChange}
      {...overrides}
    />
  );
  return { onChange, row: screen.getByRole('switch', { name: 'Demo label' }) };
}

afterEach(cleanup);

describe('SwitchRow', () => {
  it('is a native switch button named by its label and described by its helper', () => {
    const { row } = renderRow();

    expect(row.tagName).toBe('BUTTON');
    expect(row).toHaveAttribute('type', 'button');
    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(row).toHaveAttribute('aria-labelledby', 'demo-row-label');
    expect(row).toHaveAttribute('aria-describedby', 'demo-row-helper');
    expect(row).toHaveAccessibleDescription('Demo helper.');
  });

  it('derives its test ids and element ids from the id', () => {
    renderRow();

    expect(screen.getByTestId('demo-row')).toBe(screen.getByRole('switch'));
    expect(screen.getByTestId('demo-row-helper').textContent).toBe('Demo helper.');
    expect(document.getElementById('demo-row-label')?.textContent).toBe('Demo label');
    expect(document.getElementById('demo-row-helper')).toBe(screen.getByTestId('demo-row-helper'));
  });

  it('reports the state it asks for: the opposite of the one shown', async () => {
    const user = userEvent.setup();
    const off = renderRow({ checked: false });
    await user.click(off.row);
    expect(off.onChange).toHaveBeenCalledExactlyOnceWith(true);
    cleanup();

    const on = renderRow({ checked: true });
    expect(on.row).toHaveAttribute('aria-checked', 'true');
    await user.click(on.row);
    expect(on.onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('is reached from the keyboard with Enter and Space', async () => {
    const user = userEvent.setup();
    const { row, onChange } = renderRow();

    await user.tab();
    expect(row).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('is inert while disabled', async () => {
    const user = userEvent.setup();
    const { row, onChange } = renderRow({ disabled: true });

    expect(row).toBeDisabled();
    await user.click(row);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is enabled by default', () => {
    const { row } = renderRow();
    expect(row).toBeEnabled();
  });
});
