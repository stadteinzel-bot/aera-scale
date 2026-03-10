/**
 * AERA SCALE — Rate Limiter Tests
 * Tests for debounce, throttle, and token-bucket rate limiter.
 */
import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle, createRateLimiter } from '../utils/rateLimiter';

describe('debounce', () => {
    it('should delay execution', async () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 50);
        debounced();
        debounced();
        debounced();
        expect(fn).not.toHaveBeenCalled();
        await new Promise(r => setTimeout(r, 100));
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('throttle', () => {
    it('should execute immediately on first call', () => {
        const fn = vi.fn();
        const throttled = throttle(fn, 100);
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent calls', () => {
        const fn = vi.fn();
        const throttled = throttle(fn, 100);
        throttled();
        throttled();
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('createRateLimiter', () => {
    it('should allow bursts up to maxTokens', () => {
        const limiter = createRateLimiter({ maxTokens: 5, refillRate: 1 });
        for (let i = 0; i < 5; i++) {
            expect(limiter.tryConsume()).toBe(true);
        }
        expect(limiter.tryConsume()).toBe(false);
    });

    it('should report remaining tokens', () => {
        const limiter = createRateLimiter({ maxTokens: 10, refillRate: 5 });
        expect(limiter.remaining()).toBe(10);
        limiter.tryConsume(3);
        expect(limiter.remaining()).toBe(7);
    });

    it('should reset correctly', () => {
        const limiter = createRateLimiter({ maxTokens: 5, refillRate: 1 });
        limiter.tryConsume(5);
        expect(limiter.remaining()).toBe(0);
        limiter.reset();
        expect(limiter.remaining()).toBe(5);
    });
});
