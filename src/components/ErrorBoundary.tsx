import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-[32px] flex items-center justify-center border border-red-100 dark:border-red-900/20 shadow-xl shadow-red-500/10">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-black text-red-500">!</span>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
              Oops! Something went wrong
            </h1>
            <p className="text-slate-500 font-medium">
              The application encountered an unexpected error. This might be due to a network glitch or a state mismatch.
            </p>
            {this.state.error && (
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-left overflow-auto max-h-32 border border-slate-200 dark:border-slate-700">
                <code className="text-xs text-red-600 dark:text-red-400 font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={this.handleReset}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:scale-105 transition-all flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Reload Application</span>
            </button>
            <a
              href="/"
              className="px-8 py-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-2xl font-black border border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center space-x-2"
            >
              <Home className="w-5 h-5" />
              <span>Return Home</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
