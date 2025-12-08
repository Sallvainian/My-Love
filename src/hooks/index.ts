/**
 * Hooks Barrel File
 *
 * Re-exports all custom React hooks for convenient imports.
 *
 * @example
 * import { useNetworkStatus, useLoveNotes } from './hooks';
 */

export { useNetworkStatus, type NetworkStatus } from './useNetworkStatus';
export { useLoveNotes, type UseLoveNotesResult } from './useLoveNotes';
export {
  useVibration,
  type UseVibrationReturn,
  type VibrationPattern,
} from './useVibration';
// TD-1.0.5: Subscription health observability exports
export {
  useSubscriptionHealth,
  type SubscriptionHealth,
  type ConnectionState,
  type SubscriptionHealthWithNotify,
} from './useSubscriptionHealth';
export {
  useRealtimeMessages,
  type UseRealtimeMessagesOptions,
  type UseRealtimeMessagesResult,
} from './useRealtimeMessages';
