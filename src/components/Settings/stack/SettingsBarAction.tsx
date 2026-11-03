/**
 * SettingsBarAction -- puts a page's own action (Save, Add) in the Settings
 * bar's trailing cell. The page keeps the action's state, so a field, its
 * validity and its saving flag stay in one component instead of being lifted
 * into the stack; the bar is the stack's, so the content is portalled into it.
 * Renders nothing until the bar's cell exists.
 *
 * @component
 */

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useSettingsPage } from './settingsPageContext';

export function SettingsBarAction({ children }: { children: ReactNode }) {
  const { barTrailing } = useSettingsPage();
  return barTrailing ? createPortal(children, barTrailing) : null;
}
