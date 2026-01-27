import { Component } from 'react';
import type { ReactNode } from 'react';

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
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <div className="text-5xl mb-4">{showOfflineMessage ? '📴' : '⚠️'}</div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {showOfflineMessage
            ? "Can't load this page offline"
            : `Error loading ${viewName}`}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {showOfflineMessage
            ? 'This page needs an internet connection to load. Please reconnect and try again.'
            : 'Something went wrong while loading this view.'}
        </p>
        {error && !showOfflineMessage && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded text-left overflow-auto max-h-24">
            {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Go Home
          </button>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg"
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
export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
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
