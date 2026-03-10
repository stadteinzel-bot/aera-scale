import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────
export type Locale = 'de' | 'en' | 'fr';

export interface LocaleInfo {
    code: Locale;
    label: string;
    flag: string;
    dir: 'ltr' | 'rtl';
}

export const AVAILABLE_LOCALES: LocaleInfo[] = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
    { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
    { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
];

type TranslationMap = Record<string, string>;

interface I18nContextValue {
    t: (key: string, params?: Record<string, string | number>) => string;
    locale: Locale;
    setLocale: (locale: Locale) => void;
    availableLocales: LocaleInfo[];
    isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────
const STORAGE_KEY = 'aera-scale-locale';

function detectBrowserLocale(): Locale {
    const lang = navigator.language?.slice(0, 2)?.toLowerCase();
    if (lang === 'de' || lang === 'en' || lang === 'fr') return lang;
    return 'de'; // Default fallback
}

function getSavedLocale(): Locale {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
        if (saved && ['de', 'en', 'fr'].includes(saved)) return saved;
    } catch { }
    return detectBrowserLocale();
}

// ─── Locale Loaders (lazy) ───────────────────────────────────
const localeLoaders: Record<Locale, () => Promise<TranslationMap>> = {
    de: () => import('../locales/de.json').then(m => m.default),
    en: () => import('../locales/en.json').then(m => m.default),
    fr: () => import('../locales/fr.json').then(m => m.default),
};

// Cache loaded translations
const translationCache: Partial<Record<Locale, TranslationMap>> = {};

async function loadTranslations(locale: Locale): Promise<TranslationMap> {
    if (translationCache[locale]) return translationCache[locale]!;
    const translations = await localeLoaders[locale]();
    translationCache[locale] = translations;
    return translations;
}

// ─── Provider ────────────────────────────────────────────────
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [locale, setLocaleState] = useState<Locale>(getSavedLocale());
    const [translations, setTranslations] = useState<TranslationMap>({});
    const [fallback, setFallback] = useState<TranslationMap>({});
    const [isLoading, setIsLoading] = useState(true);
    const missingKeys = useRef(new Set<string>());

    // Load translations on locale change
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);

        const load = async () => {
            // Always load English as fallback
            const [localeData, enData] = await Promise.all([
                loadTranslations(locale),
                locale !== 'en' ? loadTranslations('en') : Promise.resolve({}),
            ]);

            if (!cancelled) {
                setTranslations(localeData);
                setFallback(enData);
                setIsLoading(false);
            }
        };

        load().catch(err => {
            console.error(`[i18n] Failed to load locale "${locale}":`, err);
            if (!cancelled) setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [locale]);

    // Set locale + persist
    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        try {
            localStorage.setItem(STORAGE_KEY, newLocale);
        } catch { }

        // Update document direction for RTL support
        const info = AVAILABLE_LOCALES.find(l => l.code === newLocale);
        if (info) {
            document.documentElement.dir = info.dir;
            document.documentElement.lang = newLocale;
        }
    }, []);

    // Set initial dir/lang
    useEffect(() => {
        const info = AVAILABLE_LOCALES.find(l => l.code === locale);
        if (info) {
            document.documentElement.dir = info.dir;
            document.documentElement.lang = locale;
        }
    }, []);

    // Translation function
    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        let text = translations[key] || fallback[key];

        if (!text) {
            // Dev mode warning for missing keys
            if (import.meta.env?.DEV && !missingKeys.current.has(key)) {
                missingKeys.current.add(key);
                console.warn(`[i18n] Missing key: "${key}" for locale "${locale}"`);
            }
            return key; // Return raw key as last resort
        }

        // Interpolation: replace {placeholder} with params
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text!.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            });
        }

        return text;
    }, [translations, fallback, locale]);

    return (
        <I18nContext.Provider value={{ t, locale, setLocale, availableLocales: AVAILABLE_LOCALES, isLoading }}>
            {children}
        </I18nContext.Provider>
    );
};

// ─── Hook ────────────────────────────────────────────────────
export function useTranslation() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('useTranslation must be used within <I18nProvider>');
    }
    return ctx;
}
