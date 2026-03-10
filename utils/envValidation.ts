/**
 * Environment Variable Validation
 * Strict boot-time checks for required configuration.
 * Fails fast with clear error messages if critical config is missing.
 */

interface EnvConfig {
    VITE_FIREBASE_API_KEY: string;
    VITE_FIREBASE_AUTH_DOMAIN: string;
    VITE_FIREBASE_PROJECT_ID: string;
    VITE_FIREBASE_STORAGE_BUCKET: string;
    VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    VITE_FIREBASE_APP_ID: string;
}

const REQUIRED_ENV_VARS: (keyof EnvConfig)[] = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
];

/**
 * Validates that all required environment variables are present.
 * Returns a list of missing variables, or empty array if all ok.
 */
export function validateEnv(): string[] {
    const missing: string[] = [];
    const env = (import.meta as any).env || {};
    // Also check runtime env from Docker injection (guarded for Node/test environments)
    const runtimeEnv = typeof window !== 'undefined' ? ((window as any)._env_ || {}) : {};

    for (const key of REQUIRED_ENV_VARS) {
        const value = env[key] || runtimeEnv[key];
        if (!value || value === 'undefined' || value.trim() === '') {
            missing.push(key);
        }
    }

    return missing;
}

/**
 * Logs a warning if any environment variables are missing.
 * Call this at app boot to catch misconfiguration early.
 */
export function checkEnvOnBoot(): void {
    const missing = validateEnv();
    if (missing.length > 0) {
        console.warn(
            `[ENV] ⚠️ Missing ${missing.length} required env vars:\n` +
            missing.map(v => `  - ${v}`).join('\n') +
            '\nSome features may not work correctly.'
        );
    }
}

/**
 * Get the current environment mode.
 */
export function getEnvMode(): 'development' | 'production' | 'test' {
    const mode = (import.meta as any).env?.MODE;
    if (mode === 'development') return 'development';
    if (mode === 'test') return 'test';
    return 'production';
}

/**
 * Check if we are running in Docker/Cloud Run (runtime env injection).
 */
export function isRuntimeEnv(): boolean {
    return typeof window !== 'undefined' && !!(window as any)._env_;
}
