import type { ReactNode } from 'react';
import { HeartCrack, TriangleAlert } from 'lucide-react';
import { Component } from 'react';
import { DESTRUCTIVE_BUTTON, PRIMARY_BUTTON } from '../shared/kitClasses';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: unknown): State {
    // Anything can be thrown. A string or plain object has no `.message`, and
    // reading one below would throw inside this, the root boundary (DW-193).
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // P1 Fix: Detect validation errors and show user-friendly messaging
      const isValidationError =
        this.state.error?.message.includes('Validation failed') ||
        this.state.error?.message.includes('Invalid');

      const Icon = isValidationError ? TriangleAlert : HeartCrack;

      return (
        <div
          className="flex min-h-screen items-center justify-center bg-page px-4"
          data-testid="error-boundary-fallback"
        >
          <div
            className="w-full max-w-md rounded-[20px] border border-line bg-card p-5 text-center shadow-card"
            data-testid="error-boundary-card"
          >
            <div
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-tint text-accent"
              data-testid="error-boundary-icon"
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-lg font-semibold text-ink">
              {isValidationError ? 'Invalid Data Detected' : 'Something went wrong'}
            </h1>
            <p className="mb-5 text-sm text-muted">
              {isValidationError
                ? 'Your settings data appears to be corrupted. Please try refreshing the page or clearing your browser storage.'
                : 'We encountered an unexpected error. Please try again.'}
            </p>
            {this.state.error && (
              <p
                className="mb-5 max-h-24 overflow-auto rounded-[14px] bg-card2 p-3 text-left font-mono text-sm wrap-break-word text-muted"
                data-testid="error-boundary-message"
              >
                {this.state.error.message}
              </p>
            )}
            <div className="grid gap-3">
              <button type="button" onClick={this.handleRetry} className={PRIMARY_BUTTON}>
                Try Again
              </button>
              {isValidationError && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('my-love-storage');
                    window.location.reload();
                  }}
                  className={DESTRUCTIVE_BUTTON}
                >
                  Clear Storage & Reload
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
