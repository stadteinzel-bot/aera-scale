/**
 * IBAN / Sensitive Data Masking Utilities
 * Ensures sensitive financial data is never displayed in full to the UI.
 */

/**
 * Masks an IBAN, showing only country code and last 4 digits.
 * Example: "DE89370400440532013000" → "DE** **** **** **** **3000"
 */
export function maskIBAN(iban: string): string {
    if (!iban || iban.length < 6) return iban || '';
    const clean = iban.replace(/\s/g, '');
    const country = clean.substring(0, 2);
    const last4 = clean.substring(clean.length - 4);
    const middleLen = clean.length - 6; // minus country(2) + last4
    const masked = '*'.repeat(middleLen);
    // Format in groups of 4 for readability
    const full = `${country}**${masked}${last4}`;
    return full.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Masks a BIC/SWIFT code, showing first 4 and last character.
 * Example: "COBADEFFXXX" → "COBA*****X"
 */
export function maskBIC(bic: string): string {
    if (!bic || bic.length < 5) return bic || '';
    const first4 = bic.substring(0, 4);
    const last = bic.substring(bic.length - 1);
    const middleLen = bic.length - 5;
    return `${first4}${'*'.repeat(middleLen + 1)}${last}`;
}

/**
 * Masks an email, showing first 2 chars and domain.
 * Example: "max.mustermann@gmail.com" → "ma***@gmail.com"
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email || '';
    const [local, domain] = email.split('@');
    const visibleChars = Math.min(2, local.length);
    return `${local.substring(0, visibleChars)}${'*'.repeat(Math.max(3, local.length - visibleChars))}@${domain}`;
}
