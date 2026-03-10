// ===== AERA SCALE — PWA Install Prompt =====
// Listens for the browser's 'beforeinstallprompt' event and shows an install banner.
// Dismissal stored in localStorage for 7 days.

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7;

export const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Don't show if recently dismissed
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DAYS * 86400000) return;

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] Install outcome:', outcome);
        setShow(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-right-4 duration-300 max-w-xs w-full">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/15 p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-aera-500 to-aera-700 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-aera-600/30">
                        <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">App installieren</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            AERA SCALE auf dem Homescreen für schnelleren Zugriff & Offline-Nutzung.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleInstall}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-aera-600 hover:bg-aera-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Installieren
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors"
                            >
                                Später
                            </button>
                        </div>
                    </div>
                    <button onClick={handleDismiss} className="text-slate-300 hover:text-slate-500 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
