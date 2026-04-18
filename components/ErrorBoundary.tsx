import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable error boundary that catches render errors in child components.
 * Shows a styled error screen with a retry button.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[22Y ErrorBoundary] ${this.props.fallbackTitle || 'Component'} crashed:`, error.message);
    console.error('[22Y ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: 'rgba(255, 0, 60, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            fontSize: 28,
          }}>
            â ï¸
          </div>
          <h2 style={{
            fontSize: 18,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
            color: 'var(--text-primary, white)',
          }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            maxWidth: 300,
            lineHeight: 1.6,
            marginBottom: 24,
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 32px',
              borderRadius: 12,
              border: '1px solid rgba(0, 240, 255, 0.3)',
              backgroundColor: 'rgba(0, 240, 255, 0.1)',
              color: '#00F0FF',
              fontSize: 11,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
