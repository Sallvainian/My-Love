import { Component } from 'react';
import type { ReactNode } from 'react';

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
      const isValidationError = this.state.error?.message.includes('Validation failed') ||
                                this.state.error?.message.includes('Invalid');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">{isValidationError ? '⚠️' : '💔'}</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {isValidationError ? 'Invalid Data Detected' : 'Something went wrong'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {isValidationError
                ? 'Your settings data appears to be corrupted. Please try refreshing the page or clearing your browser storage.'
                : 'We encountered an unexpected error. Please try again.'}
            </p>
            {this.state.error && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-mono bg-gray-100 dark:bg-gray-700 p-3 rounded">
                {this.state.error.message}
              </p>
            )}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium py-3 px-6 rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Try Again
              </button>
              {isValidationError && (
                <button
                  onClick={() => {
                    localStorage.removeItem('my-love-storage');
                    window.location.reload();
                  }}
                  className="w-full bg-gray-500 text-white font-medium py-3 px-6 rounded-lg hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg"
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
