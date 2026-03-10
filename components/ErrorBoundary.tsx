import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
                            <p className="text-slate-500 mb-6">
                                The application encountered an unexpected error. This might be due to a connection issue or a missing configuration.
                            </p>

                            <div className="bg-slate-900 text-slate-300 text-left p-4 rounded-lg text-xs font-mono overflow-auto max-h-40 mb-6">
                                <p className="font-bold text-red-400 mb-2">{this.state.error?.toString()}</p>
                                <div className="opacity-70 whitespace-pre-wrap">
                                    {this.state.errorInfo?.componentStack || "No stack trace available"}
                                </div>
                            </div>

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-aera-900 hover:bg-aera-800 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reload Application
                            </button>
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                            <p className="text-xs text-slate-400">
                                If this persists, please verify your Firebase configuration and network connection.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
