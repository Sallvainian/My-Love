/**
 * Hooks Barrel File
 *
 * Re-exports all custom React hooks for convenient imports.
 *
 * @example
 * import { useNetworkStatus, useLoveNotes } from './hooks';
 */

export { useNetworkStatus, type NetworkStatus } from './useNetworkStatus';
export { useAutoSave, type UseAutoSaveOptions } from './useAutoSave';
export { useLoveNotes, type UseLoveNotesResult } from './useLoveNotes';
export { useVibration, type UseVibrationReturn, type VibrationPattern } from './useVibration';
export { useMotionConfig } from './useMotionConfig';
export { useScriptureBroadcast } from './useScriptureBroadcast';
