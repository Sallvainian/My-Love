import { Component } from 'react';
import type { ReactNode } from 'react';
import * as Sentry from '@sentry/react';

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

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]:', error, errorInfo);
    Sentry.captureException(error, {
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
      // P1 Fix: Detect validation errors and show user-friendly messaging
      const isValidationError =
        this.state.error?.message.includes('Validation failed') ||
        this.state.error?.message.includes('Invalid');

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
          <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
            <div className="mb-4 text-6xl">{isValidationError ? '⚠️' : '💔'}</div>
            <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {isValidationError ? 'Invalid Data Detected' : 'Something went wrong'}
            </h1>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              {isValidationError
                ? 'Your settings data appears to be corrupted. Please try refreshing the page or clearing your browser storage.'
                : 'We encountered an unexpected error. Please try again.'}
            </p>
            {this.state.error && (
              <p className="mb-6 rounded bg-gray-100 p-3 font-mono text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                {this.state.error.message}
              </p>
            )}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-medium text-white shadow-md transition-all duration-200 hover:from-pink-600 hover:to-rose-600 hover:shadow-lg"
              >
                Try Again
              </button>
              {isValidationError && (
                <button
                  onClick={() => {
                    localStorage.removeItem('my-love-storage');
                    window.location.reload();
                  }}
                  className="w-full rounded-lg bg-gray-500 px-6 py-3 font-medium text-white shadow-md transition-all duration-200 hover:bg-gray-600 hover:shadow-lg"
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

export default ErrorBoundary;
