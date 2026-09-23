/**
 * NetworkStatusIndicator Component
 *
 * Visual indicator showing network connectivity state.
 *
 * States:
 * - Online: `good` (green) dot indicator
 * - Connecting: `accent` dot and spinning icon with "Connecting..." text
 * - Offline: `muted` dot and icon with offline banner
 *
 * Kit colours: the style kit has no warning colour, and `danger` is reserved
 * for destructive actions and failures, so being offline -- an expected state
 * the app keeps working through -- is a neutral `muted`, reconnecting is the
 * pink `accent`, and green stays "online". The banner is a `card2` strip with a
 * `line` hairline under it; every colour is a kit token that follows the OS
 * theme.
 *
 * Story 1.5: Task 2 - Network Status Indicator Component (AC-1.5.1)
 */

import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../hooks';

interface NetworkStatusIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Show only when offline (hide when online) */
  showOnlyWhenOffline?: boolean;
}

/**
 * Network status indicator with visual dot and optional banner
 *
 * @example
 * ```tsx
 * // Always visible indicator
 * <NetworkStatusIndicator />
 *
 * // Only show when offline
 * <NetworkStatusIndicator showOnlyWhenOffline />
 * ```
 */
export function NetworkStatusIndicator({
  className = '',
  showOnlyWhenOffline = false,
}: NetworkStatusIndicatorProps) {
  const { isOnline, isConnecting } = useNetworkStatus();

  // If showOnlyWhenOffline is true and we're online (and not connecting), hide the indicator
  if (showOnlyWhenOffline && isOnline && !isConnecting) {
    return null;
  }

  // Determine status and styles
  const getStatusConfig = () => {
    if (!isOnline && !isConnecting) {
      // Offline state
      return {
        dotColor: 'bg-muted',
        textColor: 'text-muted',
        icon: WifiOff,
        label: 'Offline',
        description: "You're offline. Changes will sync when reconnected.",
        showBanner: true,
        ariaLabel: 'Network status: Offline. Your changes will sync when you reconnect.',
      };
    }

    if (isConnecting) {
      // Connecting/transitional state
      return {
        dotColor: 'bg-accent',
        textColor: 'text-accent',
        icon: Loader2,
        label: 'Connecting...',
        description: 'Reconnecting to the network...',
        showBanner: true,
        ariaLabel: 'Network status: Connecting. Please wait while we reconnect.',
        animate: true,
      };
    }

    // Online state
    return {
      dotColor: 'bg-good',
      textColor: 'text-good',
      icon: Wifi,
      label: 'Online',
      description: '',
      showBanner: false,
      ariaLabel: 'Network status: Online',
    };
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div
      className={`network-status-indicator ${className}`}
      role="status"
      aria-live="polite"
      aria-label={config.ariaLabel}
      data-testid="network-status-indicator"
      data-status={!isOnline && !isConnecting ? 'offline' : isConnecting ? 'connecting' : 'online'}
    >
      {/* Banner for offline/connecting states */}
      {config.showBanner && (
        <div
          className="flex items-center justify-center gap-2 border-b border-line bg-card2 px-4 py-2 transition-all duration-300 ease-in-out"
        >
          {/* Status dot */}
          <span
            className={`inline-block h-2 w-2 rounded-full ${config.dotColor} ${config.animate ? 'animate-pulse' : ''} `}
            aria-hidden="true"
          />

          {/* Icon */}
          <IconComponent
            size={16}
            className={`${config.textColor} ${config.animate ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />

          {/* Status text */}
          <span className="text-sm font-medium text-ink">{config.label}</span>

          {/* Description */}
          {config.description && (
            <span className="ml-2 text-sm text-muted">{config.description}</span>
          )}
        </div>
      )}

      {/* Compact indicator for online state (optional - can be used inline) */}
      {!config.showBanner && !showOnlyWhenOffline && (
        <div className="flex items-center gap-1.5" title={config.ariaLabel}>
          <span
            className={`inline-block h-2 w-2 rounded-full ${config.dotColor}`}
            aria-hidden="true"
          />
          <IconComponent size={14} className={config.textColor} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
