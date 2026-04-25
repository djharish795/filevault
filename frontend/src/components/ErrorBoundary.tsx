import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback = ({ error, resetError }: { error?: Error; resetError: () => void }) => {
  const handleGoHome = () => {
    resetError();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4">
      <div className="max-w-md w-full bg-white dark:bg-surface-900 rounded-2xl shadow-premium border border-surface-200 dark:border-surface-800 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        
        <h1 className="text-xl font-semibold text-surface-900 dark:text-surface-50 mb-2">
          Something went wrong
        </h1>
        
        <p className="text-surface-500 text-sm mb-6">
          The page encountered an unexpected error. This has been logged for our team to investigate.
        </p>
        
        {error && (
          <details className="text-left mb-6 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg text-xs">
            <summary className="cursor-pointer font-medium text-surface-700 dark:text-surface-300 mb-2">
              Technical Details
            </summary>
            <code className="text-red-600 dark:text-red-400 break-all">
              {error.message}
            </code>
          </details>
        )}
        
        <div className="flex gap-3 justify-center">
          <Button
            onClick={resetError}
            variant="outline"
            className="rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <Button
            onClick={handleGoHome}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
};