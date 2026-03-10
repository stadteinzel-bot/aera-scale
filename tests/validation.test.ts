/**
 * AERA SCALE — Validation Utilities Tests
 * Tests for input sanitization and field validation functions.
 */
import { describe, it, expect } from 'vitest';
import {
    sanitizeHTML, stripHTML, isValidEmail, isValidIBAN,
    isValidPhone, isValidTextInput, isValidAmount, sanitizeObject
} from '../utils/validation';

describe('sanitizeHTML', () => {
    it('should strip script tags', () => {
        expect(sanitizeHTML('<script>alert("xss")</script>Hello'))
            .not.toContain('<script>');
    });

    it('should escape HTML entities', () => {
        const result = sanitizeHTML('Hello <world> & "friends"');
        expect(result).toContain('&lt;');
        expect(result).toContain('&amp;');
        expect(result).toContain('&quot;');
    });

    it('should handle empty input', () => {
        expect(sanitizeHTML('')).toBe('');
    });
});

describe('stripHTML', () => {
    it('should remove all HTML tags', () => {
        expect(stripHTML('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should handle empty input', () => {
        expect(stripHTML('')).toBe('');
    });
});

describe('isValidEmail', () => {
    it('should accept valid emails', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('a.b+c@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('not-an-email')).toBe(false);
        expect(isValidEmail('@domain.com')).toBe(false);
        expect(isValidEmail('a'.repeat(255) + '@test.com')).toBe(false);
    });
});

describe('isValidIBAN', () => {
    it('should accept valid IBANs', () => {
        expect(isValidIBAN('DE89370400440532013000')).toBe(true);
        expect(isValidIBAN('DE89 3704 0044 0532 0130 00')).toBe(true);
    });

    it('should reject invalid IBANs', () => {
        expect(isValidIBAN('')).toBe(false);
        expect(isValidIBAN('1234')).toBe(false);
        expect(isValidIBAN('XX')).toBe(false);
    });
});

describe('isValidPhone', () => {
    it('should accept valid phone numbers', () => {
        expect(isValidPhone('+49 170 1234567')).toBe(true);
        expect(isValidPhone('01701234567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
        expect(isValidPhone('')).toBe(false);
        expect(isValidPhone('123')).toBe(false);
    });
});

describe('isValidTextInput', () => {
    it('should accept valid text', () => {
        expect(isValidTextInput('Hello World')).toBe(true);
        expect(isValidTextInput('Line1\nLine2')).toBe(true);
    });

    it('should reject control characters', () => {
        expect(isValidTextInput('Test\x00Bad')).toBe(false);
    });

    it('should reject text exceeding max length', () => {
        expect(isValidTextInput('a'.repeat(501))).toBe(false);
        expect(isValidTextInput('a'.repeat(500))).toBe(true);
    });
});

describe('isValidAmount', () => {
    it('should accept valid amounts', () => {
        expect(isValidAmount(100)).toBe(true);
        expect(isValidAmount(0)).toBe(true);
        expect(isValidAmount(9999999)).toBe(true);
    });

    it('should reject invalid amounts', () => {
        expect(isValidAmount(NaN)).toBe(false);
        expect(isValidAmount(Infinity)).toBe(false);
        expect(isValidAmount(-1)).toBe(false);
        expect(isValidAmount(10_000_001)).toBe(false);
    });
});

describe('sanitizeObject', () => {
    it('should strip HTML from all string fields', () => {
        const input = { name: '<b>Bold</b> Name', count: 5 };
        const result = sanitizeObject(input);
        expect(result.name).toBe('Bold Name');
        expect(result.count).toBe(5);
    });

    it('should handle nested objects', () => {
        const input = { a: { b: '<b>bold</b> text' } };
        const result = sanitizeObject(input);
        expect(result.a.b).toBe('bold text');
    });

    it('should handle arrays', () => {
        const input = { tags: ['<b>one</b>', 'two'] };
        const result = sanitizeObject(input);
        expect(result.tags).toEqual(['one', 'two']);
    });
});
