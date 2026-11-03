/**
 * Shared by the Settings stack tests: the popstate listener that plays App's
 * part, which on a history restore hands the URL's page to `showSettingsPage` (set here through `setState`, which
 * the lint rule on `getState` in component-tree files allows).
 * Add it in `beforeEach` and remove it in `afterEach`.
 */
import { settingsPathFromRoute } from '../../../stores/slices/navigationSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { stripBasePath } from '../../../utils/basePath';

export const onPopState = () => {
  const route = stripBasePath(window.location.pathname);
  useAppStore.setState({ settingsPath: settingsPathFromRoute(route) });
};
