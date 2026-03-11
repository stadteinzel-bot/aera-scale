// ===== AERA SCALE — PWA Update Prompt (Improved UX) =====
// Shows an animated toast when a new service worker is waiting.
// Features:
//   - Framer Motion slide-up animation
//   - Auto-dismiss countdown (60s) with visual progress bar
//   - "Jetzt aktualisieren" primary CTA
//   - "Später" snooze (dismisses for 24h, re-shows next session)
//   - Keyboard accessible (Escape closes)

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

const SNOOZE_KEY  = 'pwa-update-snoozed';
const SNOOZE_MS   = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_CLOSE  = 60;  // seconds until auto-dismiss

export const PWAUpdatePrompt: React.FC = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r)    { console.log('[PWA] SW registered:', r); },
        onRegisterError(e) { console.error('[PWA] SW error:', e); },
    });

    const [visible, setVisible] = useState(false);
    const [countdown, setCountdown] = useState(AUTO_CLOSE);
    const [updating, setUpdating] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Show prompt when SW is ready, unless snoozed
    useEffect(() => {
        if (!needRefresh) return;
        const snoozed = localStorage.getItem(SNOOZE_KEY);
        if (snoozed && Date.now() - parseInt(snoozed) < SNOOZE_MS) {
            // Still snoozed — silently register but don't show
            return;
        }
        setVisible(true);
        setCountdown(AUTO_CLOSE);
    }, [needRefresh]);

    // Countdown timer while prompt is visible
    useEffect(() => {
        if (!visible) return;
        timerRef.current = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) {
                    snooze();
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [visible]);

    // Keyboard: Escape = snooze
    useEffect(() => {
        if (!visible) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') snooze(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [visible]);

    const handleUpdate = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setUpdating(true);
        await updateServiceWorker(true);
    };

    const snooze = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        localStorage.setItem(SNOOZE_KEY, Date.now().toString());
        setVisible(false);
        setNeedRefresh(false);
    };

    const progressPct = ((AUTO_CLOSE - countdown) / AUTO_CLOSE) * 100;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="pwa-update"
                    role="alert"
                    aria-live="polite"
                    initial={{ opacity: 0, y: 32, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0,  scale: 1 }}
                    exit={{    opacity: 0, y: 20, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4"
                >
                    <div className="relative overflow-hidden bg-aera-950 border border-aera-700/60 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-md">

                        {/* Progress bar — drains over AUTO_CLOSE seconds */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-aera-800/60">
                            <motion.div
                                className="h-full bg-gradient-to-r from-aera-400 to-aera-500"
                                initial={{ width: '0%' }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ ease: 'linear', duration: 1 }}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-4 pt-5">
                            {/* Icon */}
                            <div className="w-9 h-9 bg-gradient-to-br from-aera-500 to-aera-700 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-aera-600/30 mt-0.5">
                                {updating
                                    ? <RefreshCw className="w-4 h-4 text-white animate-spin" />
                                    : <Sparkles  className="w-4 h-4 text-white" />
                                }
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white leading-snug">
                                    {updating ? 'Wird aktualisiert…' : 'Neue Version verfügbar'}
                                </p>
                                <p className="text-xs text-aera-300/80 mt-0.5 leading-relaxed">
                                    {updating
                                        ? 'AERA SCALE startet neu.'
                                        : 'Verbesserungen & Fehlerbehebungen sind bereit.'
                                    }
                                </p>

                                {!updating && (
                                    <div className="flex items-center gap-2 mt-3">
                                        <button
                                            onClick={handleUpdate}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-aera-500 hover:bg-aera-400 active:scale-95 text-white text-xs font-semibold rounded-lg transition-all duration-150 shadow-md shadow-aera-600/20"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Jetzt aktualisieren
                                        </button>
                                        <button
                                            onClick={snooze}
                                            className="px-3 py-1.5 text-aera-400 hover:text-white text-xs font-medium rounded-lg transition-colors duration-150"
                                        >
                                            Später ({countdown}s)
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Close */}
                            {!updating && (
                                <button
                                    onClick={snooze}
                                    aria-label="Schließen"
                                    className="text-aera-500 hover:text-white transition-colors mt-0.5 shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PWAUpdatePrompt;
