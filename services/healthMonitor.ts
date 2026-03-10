/**
 * AERA SCALE — Health Monitoring & Structured Error Tracking
 * Provides centralized error collection, performance metrics, and health reporting.
 */

// ── Error Severity Levels ──
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface TrackedError {
    id: string;
    message: string;
    stack?: string;
    severity: ErrorSeverity;
    component?: string;
    timestamp: string;
    userId?: string;
    metadata?: Record<string, any>;
}

interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: string;
    metadata?: Record<string, any>;
}

// ── In-Memory Error Store (capped at 100) ──
const MAX_ERRORS = 100;
const MAX_METRICS = 200;
const errors: TrackedError[] = [];
const metrics: PerformanceMetric[] = [];

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Track an error with structured metadata.
 */
export function trackError(
    message: string,
    options: {
        severity?: ErrorSeverity;
        component?: string;
        stack?: string;
        metadata?: Record<string, any>;
    } = {}
): string {
    const id = generateId();
    const entry: TrackedError = {
        id,
        message,
        stack: options.stack,
        severity: options.severity || 'medium',
        component: options.component,
        timestamp: new Date().toISOString(),
        metadata: options.metadata,
    };

    errors.push(entry);
    if (errors.length > MAX_ERRORS) errors.shift();

    // Log to console based on severity
    if (entry.severity === 'critical' || entry.severity === 'high') {
        console.error(`[Health] ${entry.severity.toUpperCase()}: ${message}`, options.metadata || '');
    }

    return id;
}

/**
 * Track a performance metric (e.g., API call duration, render time).
 */
export function trackPerformance(name: string, duration: number, metadata?: Record<string, any>): void {
    metrics.push({
        name,
        duration,
        timestamp: new Date().toISOString(),
        metadata,
    });
    if (metrics.length > MAX_METRICS) metrics.shift();
}

/**
 * Measure the duration of an async operation.
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        trackPerformance(name, performance.now() - start, { success: true });
        return result;
    } catch (e: any) {
        trackPerformance(name, performance.now() - start, { success: false });
        trackError(e.message || String(e), {
            severity: 'high',
            component: name,
            stack: e.stack,
        });
        throw e;
    }
}

/**
 * Generate a health report summarizing current application state.
 */
export function getHealthReport() {
    const now = Date.now();
    const last5min = errors.filter(e => now - new Date(e.timestamp).getTime() < 5 * 60 * 1000);
    const criticalErrors = errors.filter(e => e.severity === 'critical' || e.severity === 'high');

    const avgMetricDuration = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
        : 0;

    const slowOps = metrics.filter(m => m.duration > 3000);

    return {
        status: criticalErrors.length > 0 ? 'degraded' : 'healthy',
        totalErrors: errors.length,
        errorsLast5min: last5min.length,
        criticalErrors: criticalErrors.length,
        totalMetrics: metrics.length,
        avgResponseTime: Math.round(avgMetricDuration),
        slowOperations: slowOps.length,
        recentErrors: last5min.slice(-5),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Get all tracked errors (for debugging/admin).
 */
export function getTrackedErrors(): ReadonlyArray<TrackedError> {
    return [...errors];
}

/**
 * Get all performance metrics (for debugging/admin).
 */
export function getPerformanceMetrics(): ReadonlyArray<PerformanceMetric> {
    return [...metrics];
}

/**
 * Clear all tracked data (for testing).
 */
export function resetHealth(): void {
    errors.length = 0;
    metrics.length = 0;
}

// ── Global Error Handler ──
// Catches unhandled errors and promise rejections
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        trackError(event.message, {
            severity: 'critical',
            component: 'window.onerror',
            stack: event.error?.stack,
            metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        trackError(event.reason?.message || String(event.reason), {
            severity: 'high',
            component: 'unhandledrejection',
            stack: event.reason?.stack,
        });
    });
}
