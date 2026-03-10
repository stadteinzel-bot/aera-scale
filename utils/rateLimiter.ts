/**
 * Client-Side Rate Limiting & Debounce Utilities
 * Prevents excessive writes/reads that could exhaust Firestore quotas or cause cost spikes.
 */

// ── Debounce ──

/**
 * Creates a debounced version of a function that delays execution until
 * `wait` ms have passed since the last invocation.
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

// ── Throttle ──

/**
 * Creates a throttled version of a function that executes at most once
 * every `interval` ms. Trailing calls are preserved.
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    interval: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        const now = Date.now();
        const remaining = interval - (now - lastCall);
        if (remaining <= 0) {
            if (timeout) { clearTimeout(timeout); timeout = null; }
            lastCall = now;
            fn(...args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                lastCall = Date.now();
                timeout = null;
                fn(...args);
            }, remaining);
        }
    };
}

// ── Rate Limiter (Token Bucket) ──

interface RateLimiterConfig {
    maxTokens: number;        // Max burst capacity
    refillRate: number;       // Tokens added per second
    refillInterval?: number;  // Auto-refill interval in ms (default: 1000)
}

/**
 * Token-bucket rate limiter for protecting write operations.
 * Usage:
 *   const limiter = createRateLimiter({ maxTokens: 10, refillRate: 2 });
 *   if (limiter.tryConsume()) { // proceed with write }
 */
export function createRateLimiter(config: RateLimiterConfig) {
    let tokens = config.maxTokens;
    const refillMs = config.refillInterval || 1000;
    let lastRefill = Date.now();

    function refill() {
        const now = Date.now();
        const elapsed = now - lastRefill;
        const newTokens = Math.floor(elapsed / refillMs) * config.refillRate;
        if (newTokens > 0) {
            tokens = Math.min(config.maxTokens, tokens + newTokens);
            lastRefill = now;
        }
    }

    return {
        /** Try to consume 1 token. Returns true if allowed, false if rate-limited. */
        tryConsume(count: number = 1): boolean {
            refill();
            if (tokens >= count) {
                tokens -= count;
                return true;
            }
            return false;
        },
        /** Get remaining tokens. */
        remaining(): number {
            refill();
            return tokens;
        },
        /** Reset the limiter to max capacity. */
        reset() {
            tokens = config.maxTokens;
            lastRefill = Date.now();
        },
    };
}

// ── Pre-configured Rate Limiters ──

/** Write operations: max 20 writes/sec, burst up to 30 */
export const writeRateLimiter = createRateLimiter({
    maxTokens: 30,
    refillRate: 20,
});

/** Read operations: max 50 reads/sec, burst up to 100 */
export const readRateLimiter = createRateLimiter({
    maxTokens: 100,
    refillRate: 50,
});
