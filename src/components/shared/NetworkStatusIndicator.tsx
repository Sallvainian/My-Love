/**
 * NetworkStatusIndicator Component
 *
 * Visual indicator showing network connectivity state.
 *
 * States:
 * - Online: Green dot indicator
 * - Connecting: Yellow dot indicator with "Connecting..." text
 * - Offline: Red dot indicator with offline banner
 *
 * UX Spec Colors:
 * - Success Green: #51CF66
 * - Warning Yellow: #FCC419
 * - Error Coral Red: #FF6B6B
 *
 * Story 1.5: Task 2 - Network Status Indicator Component (AC-1.5.1)
 */

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
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
        dotColor: 'bg-[#FF6B6B]', // Error Coral Red
        textColor: 'text-[#FF6B6B]',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
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
        dotColor: 'bg-[#FCC419]', // Warning Yellow
        textColor: 'text-[#FCC419]',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
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
      dotColor: 'bg-[#51CF66]', // Success Green
      textColor: 'text-[#51CF66]',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
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
          className={`
            flex items-center justify-center gap-2 px-4 py-2
            ${config.bgColor} ${config.borderColor} border-b
            transition-all duration-300 ease-in-out
          `}
        >
          {/* Status dot */}
          <span
            className={`
              inline-block w-2 h-2 rounded-full ${config.dotColor}
              ${config.animate ? 'animate-pulse' : ''}
            `}
            aria-hidden="true"
          />

          {/* Icon */}
          <IconComponent
            size={16}
            className={`${config.textColor} ${config.animate ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />

          {/* Status text */}
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.label}
          </span>

          {/* Description */}
          {config.description && (
            <span className="text-sm text-gray-600 ml-2">
              {config.description}
            </span>
          )}
        </div>
      )}

      {/* Compact indicator for online state (optional - can be used inline) */}
      {!config.showBanner && !showOnlyWhenOffline && (
        <div className="flex items-center gap-1.5" title={config.ariaLabel}>
          <span
            className={`inline-block w-2 h-2 rounded-full ${config.dotColor}`}
            aria-hidden="true"
          />
          <IconComponent
            size={14}
            className={config.textColor}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline network status dot (no banner)
 *
 * Use this for header/status bar integration where space is limited.
 *
 * @example
 * ```tsx
 * <header>
 *   <NetworkStatusDot />
 *   <h1>My App</h1>
 * </header>
 * ```
 */
export function NetworkStatusDot({ className = '' }: { className?: string }) {
  const { isOnline, isConnecting } = useNetworkStatus();

  const getDotConfig = () => {
    if (!isOnline && !isConnecting) {
      return {
        color: 'bg-[#FF6B6B]', // Error Coral Red
        title: 'Offline',
        animate: false,
      };
    }
    if (isConnecting) {
      return {
        color: 'bg-[#FCC419]', // Warning Yellow
        title: 'Connecting...',
        animate: true,
      };
    }
    return {
      color: 'bg-[#51CF66]', // Success Green
      title: 'Online',
      animate: false,
    };
  };

  const config = getDotConfig();

  return (
    <span
      className={`
        inline-block w-2.5 h-2.5 rounded-full
        ${config.color}
        ${config.animate ? 'animate-pulse' : ''}
        ${className}
      `}
      title={config.title}
      role="status"
      aria-label={`Network status: ${config.title}`}
    />
  );
}

export default NetworkStatusIndicator;
