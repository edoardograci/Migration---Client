import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background text-foreground">
                    <div className="bg-destructive/10 p-6 rounded-lg max-w-md w-full">
                        <h2 className="text-xl font-bold text-destructive mb-2">Something went wrong</h2>
                        <p className="text-sm text-muted-foreground mb-4 break-words">{this.state.error?.message}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded font-medium transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
