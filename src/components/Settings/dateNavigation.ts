/**
 * Date navigation -- how a date's or an event's page leaves for the Dates
 * list. It sits outside the page modules so they export only components
 * (`react-refresh/only-export-components`).
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSettingsPage } from './stack/settingsPageContext';

/**
 * Goes back one level (to the Dates list) the first time `absent` is true on
 * this mount. Returns `leave`, the same once-only go-back for a page's own
 * exit (a delete that succeeded), so an exit and the absence fallback never
 * both go back. The ref keeps StrictMode's second effect run, and any later
 * change, from going back again.
 */
export function useFallBackToDates(absent: boolean): () => void {
  const { goBack } = useSettingsPage();
  const fired = useRef(false);

  const leave = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    goBack();
  }, [goBack]);

  useEffect(() => {
    if (absent) leave();
  }, [absent, leave]);

  return leave;
}
