/**
 * AERA SCALE — Mask Utilities Tests
 * Tests for IBAN and BIC masking functions.
 */
import { describe, it, expect } from 'vitest';
import { maskIBAN, maskBIC } from '../utils/maskUtils';

describe('maskIBAN', () => {
    it('should mask characters showing only country code and last 4 digits', () => {
        const masked = maskIBAN('DE89370400440532013000');
        // maskIBAN shows country (2 chars) + ** + masked middle + last 4
        expect(masked).toMatch(/^DE/);
        expect(masked).toMatch(/3000$/);
        expect(masked).toContain('*');
        // Should NOT show the full check digits
        expect(masked).not.toBe('DE89370400440532013000');
    });

    it('should handle short IBANs gracefully', () => {
        expect(maskIBAN('DE89')).toBe('DE89'); // < 6 chars, returned as-is
        expect(maskIBAN('')).toBe('');
    });

    it('should handle IBAN with spaces', () => {
        const masked = maskIBAN('DE89 3704 0044 0532 0130 00');
        expect(masked).toContain('*');
    });
});

describe('maskBIC', () => {
    it('should mask middle characters of a BIC', () => {
        const masked = maskBIC('COBADEFFXXX');
        expect(masked).toMatch(/^COBA/);   // First 4 visible
        expect(masked).toMatch(/X$/);       // Last char visible
        expect(masked).toContain('*');
    });

    it('should handle short BICs', () => {
        expect(maskBIC('COBA')).toBe('COBA'); // < 5 chars, returned as-is
    });

    it('should handle empty BIC', () => {
        expect(maskBIC('')).toBe('');
    });
});
