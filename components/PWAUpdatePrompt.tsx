// ===== AERA SCALE — PWA Update Prompt =====
// Shows a toast when a new service worker is ready. User clicks to reload.

import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdatePrompt: React.FC = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) { console.log('[PWA] SW registered:', r); },
        onRegisterError(e) { console.error('[PWA] SW error:', e); },
    });

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 bg-aera-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-black/40 border border-aera-700/50 max-w-sm">
                <div className="w-8 h-8 bg-aera-600 rounded-lg flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Update verfügbar</p>
                    <p className="text-xs text-aera-300 mt-0.5">Neue Version von AERA SCALE</p>
                </div>
                <button
                    onClick={() => updateServiceWorker(true)}
                    className="px-3 py-1.5 bg-aera-500 hover:bg-aera-400 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                >
                    Aktualisieren
                </button>
                <button onClick={() => setNeedRefresh(false)} className="text-aera-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default PWAUpdatePrompt;
