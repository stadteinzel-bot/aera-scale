/**
 * Input Validation & Sanitization Utilities
 * Protects against XSS, injection, and invalid data at the application layer.
 */

// ── HTML / XSS Sanitization ──

const DANGEROUS_TAGS = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const DANGEROUS_ATTRS = /\s(on\w+|style)\s*=\s*["'][^"']*["']/gi;
const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/**
 * Strips dangerous HTML tags and event handlers while preserving text content.
 */
export function sanitizeHTML(input: string): string {
    if (!input) return '';
    return input
        .replace(DANGEROUS_TAGS, '')
        .replace(DANGEROUS_ATTRS, '')
        .replace(/[&<>"']/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Strips all HTML tags, returning only text content.
 */
export function stripHTML(input: string): string {
    if (!input) return '';
    return input.replace(/<[^>]*>/g, '').trim();
}

// ── Field Validation ──

/**
 * Validates an email address format.
 */
export function isValidEmail(email: string): boolean {
    if (!email || email.length > 254) return false;
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email);
}

/**
 * Validates an IBAN format (basic structural check).
 */
export function isValidIBAN(iban: string): boolean {
    if (!iban) return false;
    const clean = iban.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(clean);
}

/**
 * Validates a phone number (international format).
 */
export function isValidPhone(phone: string): boolean {
    if (!phone) return false;
    const clean = phone.replace(/[\s\-().]/g, '');
    return /^\+?\d{7,15}$/.test(clean);
}

/**
 * Validates that a string is within safe length bounds and contains no control characters.
 */
export function isValidTextInput(value: string, maxLength: number = 500): boolean {
    if (!value || value.length > maxLength) return false;
    // Reject control characters except newline/tab
    return !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value);
}

/**
 * Validates a monetary/numeric value is within reasonable bounds.
 */
export function isValidAmount(value: number, min: number = 0, max: number = 10_000_000): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value) && value >= min && value <= max;
}

// ── Object Sanitization ──

/**
 * Recursively sanitizes all string values in an object to prevent XSS.
 * Preserves object structure while cleaning dangerous content.
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;
    const cleaned = { ...obj } as any;
    for (const [key, value] of Object.entries(cleaned)) {
        if (typeof value === 'string') {
            cleaned[key] = stripHTML(value);
        } else if (Array.isArray(value)) {
            cleaned[key] = value.map(item =>
                typeof item === 'string' ? stripHTML(item)
                    : typeof item === 'object' && item !== null ? sanitizeObject(item)
                        : item
            );
        } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            cleaned[key] = sanitizeObject(value);
        }
    }
    return cleaned;
}
