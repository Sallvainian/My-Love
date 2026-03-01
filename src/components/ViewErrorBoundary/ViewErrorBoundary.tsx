import { Component } from 'react';
import type { ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface ViewErrorFallbackProps {
  error: Error | null;
  isOffline: boolean;
  viewName: string;
  onRetry: () => void;
  onNavigateHome: () => void;
}

/**
 * Inline error UI that keeps navigation visible.
 * Shows appropriate messaging for offline vs other errors.
 */
function ViewErrorFallback({
  error,
  isOffline,
  viewName,
  onRetry,
  onNavigateHome,
}: ViewErrorFallbackProps) {
  const isChunkError =
    error?.message.includes('Failed to fetch dynamically imported module') ||
    error?.message.includes('Loading chunk') ||
    error?.message.includes('ChunkLoadError');

  const showOfflineMessage = isOffline || isChunkError;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-lg dark:bg-gray-800">
        <div className="mb-4 text-5xl">{showOfflineMessage ? '📴' : '⚠️'}</div>
        <h2 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-100">
          {showOfflineMessage ? "Can't load this page offline" : `Error loading ${viewName}`}
        </h2>
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          {showOfflineMessage
            ? 'This page needs an internet connection to load. Please reconnect and try again.'
            : 'Something went wrong while loading this view.'}
        </p>
        {error && !showOfflineMessage && (
          <p className="mb-4 max-h-24 overflow-auto rounded bg-gray-100 p-2 text-left font-mono text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {error.message}
          </p>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={onNavigateHome}
            className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Go Home
          </button>
          <button
            onClick={onRetry}
            className="rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 font-medium text-white shadow-md transition-all hover:from-pink-600 hover:to-rose-600 hover:shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

interface ViewErrorBoundaryProps {
  children: ReactNode;
  viewName: string;
  onNavigateHome: () => void;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  lastViewName: string;
}

/**
 * Error boundary specifically for lazy-loaded views.
 * - Shows inline error UI (doesn't hide navigation)
 * - Resets when viewName changes (user navigates away)
 * - Detects offline/chunk errors for appropriate messaging
 */
export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      lastViewName: props.viewName,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ViewErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  static getDerivedStateFromProps(
    props: ViewErrorBoundaryProps,
    state: ViewErrorBoundaryState
  ): Partial<ViewErrorBoundaryState> | null {
    // Reset error state when view changes
    if (props.viewName !== state.lastViewName) {
      return {
        hasError: false,
        error: null,
        lastViewName: props.viewName,
      };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[ViewErrorBoundary] Error in ${this.props.viewName}:`, error, errorInfo);
    Sentry.captureException(error, {
      tags: { view: this.props.viewName },
      contexts: { react: { componentStack: errorInfo.componentStack ?? '' } },
    });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ViewErrorFallback
          error={this.state.error}
          isOffline={!navigator.onLine}
          viewName={this.props.viewName}
          onRetry={this.handleRetry}
          onNavigateHome={this.props.onNavigateHome}
        />
      );
    }

    return this.props.children;
  }
}

export default ViewErrorBoundary;
