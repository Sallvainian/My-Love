import type { ReactNode } from 'react';
import { TriangleAlert, WifiOff } from 'lucide-react';
import { Component } from 'react';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../shared/kitClasses';

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

  const Icon = showOfflineMessage ? WifiOff : TriangleAlert;

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4"
      data-testid="view-error-boundary"
    >
      <div className="w-full max-w-md rounded-[20px] border border-line bg-card p-5 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-tint text-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-ink">
          {showOfflineMessage ? "Can't load this page offline" : `Error loading ${viewName}`}
        </h2>
        <p className="mb-5 text-sm text-muted">
          {showOfflineMessage
            ? 'This page needs an internet connection to load. Please reconnect and try again.'
            : 'Something went wrong while loading this view.'}
        </p>
        {error && !showOfflineMessage && (
          <p className="mb-5 max-h-24 overflow-auto rounded-[14px] bg-card2 p-3 text-left font-mono text-sm break-words text-muted">
            {error.message}
          </p>
        )}
        <div className="grid gap-3">
          <button
            type="button"
            onClick={onRetry}
            data-testid="error-try-again"
            className={PRIMARY_BUTTON}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onNavigateHome}
            data-testid="error-go-home"
            className={SECONDARY_BUTTON}
          >
            Go Home
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

  static getDerivedStateFromError(error: unknown): Partial<ViewErrorBoundaryState> {
    // Anything can be thrown; the fallback reads `.message` (DW-193).
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
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
