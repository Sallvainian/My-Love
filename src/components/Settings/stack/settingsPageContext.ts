/**
 * What `SettingsStack` hands the page it renders: the back action the bar's
 * arrow runs (a page that saves returns one level with it) and the bar's
 * trailing cell, which `SettingsBarAction` portals a page's Save or Add into.
 */

import { createContext, useContext } from 'react';

export interface SettingsPageContextValue {
  /** Returns one level, exactly as the bar's back arrow does. */
  goBack: () => void;
  /** The bar's trailing cell; `null` until the bar has mounted. */
  barTrailing: HTMLElement | null;
}

export const SettingsPageContext = createContext<SettingsPageContextValue>({
  goBack: () => {},
  barTrailing: null,
});

export function useSettingsPage(): SettingsPageContextValue {
  return useContext(SettingsPageContext);
}
