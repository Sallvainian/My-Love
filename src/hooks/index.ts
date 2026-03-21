/**
 * Hooks Barrel File
 *
 * Re-exports all custom React hooks for convenient imports.
 *
 * @example
 * import { useNetworkStatus, useLoveNotes } from './hooks';
 */

export { useAutoSave, type UseAutoSaveOptions } from './useAutoSave';
export { useFocusTrap } from './useFocusTrap';
export { useLoveNotes, type UseLoveNotesResult } from './useLoveNotes';
export { useMotionConfig } from './useMotionConfig';
export { useNetworkStatus, type NetworkStatus } from './useNetworkStatus';
export { useScriptureBroadcast } from './useScriptureBroadcast';
export { useScripturePresence, type PartnerPresenceInfo } from './useScripturePresence';
export { useVibration, type UseVibrationReturn, type VibrationPattern } from './useVibration';
