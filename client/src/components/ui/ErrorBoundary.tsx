import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="h-screen bg-tavern-bg flex items-center justify-center p-8">
          <div className="tavern-card p-6 max-w-lg w-full">
            <h2 className="font-serif text-red-400 text-xl mb-3">Something went wrong</h2>
            <pre className="text-xs text-tavern-muted bg-tavern-bg rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              className="btn-secondary mt-4 text-sm"
              onClick={() => window.location.href = '/dashboard'}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
