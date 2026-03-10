/**
 * ===== AERA SCALE — Session Timeout Modal =====
 * 
 * Full-screen warning modal shown 2 minutes before session timeout.
 * User can extend their session or log out immediately.
 */

import React from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
    remainingSeconds: number;
    onExtend: () => void;
    onLogout: () => void;
}

const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({ remainingSeconds, onExtend, onLogout }) => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Warning bar */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Sitzung läuft ab</h3>
                        <p className="text-white/80 text-sm">Inaktivität erkannt</p>
                    </div>
                </div>

                <div className="p-6">
                    {/* Countdown */}
                    <div className="text-center mb-6">
                        <div className="text-5xl font-mono font-bold text-slate-800 tabular-nums">
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </div>
                        <p className="text-sm text-slate-500 mt-2">
                            Ihre Sitzung wird in {minutes > 0 ? `${minutes} Minute${minutes !== 1 ? 'n' : ''} und ` : ''}{seconds} Sekunden automatisch beendet.
                        </p>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${(remainingSeconds / 120) * 100}%` }}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onLogout}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
                        >
                            <LogOut className="w-4 h-4" /> Abmelden
                        </button>
                        <button
                            onClick={onExtend}
                            className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-aera-600 text-white rounded-xl text-sm font-medium hover:bg-aera-500 transition-colors shadow-lg shadow-aera-600/20"
                        >
                            <RefreshCw className="w-4 h-4" /> Sitzung verlängern
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionTimeoutModal;
