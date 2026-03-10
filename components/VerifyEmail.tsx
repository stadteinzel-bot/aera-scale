import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { Mail, RefreshCw, Send, LogOut, CheckCircle2, Loader2, Sparkles, Building2, AlertCircle } from 'lucide-react';

const VerifyEmail: React.FC = () => {
    const { user, logout, resendVerificationEmail, refreshUser } = useAuth();
    const [isResending, setIsResending] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleResend = async () => {
        setIsResending(true);
        setError(null);
        setResendSuccess(false);
        try {
            await resendVerificationEmail();
            setResendSuccess(true);
            setTimeout(() => setResendSuccess(false), 5000);
        } catch (err: any) {
            if (err?.code === 'auth/too-many-requests') {
                setError('Zu viele Anfragen. Bitte warten Sie einen Moment.');
            } else {
                setError(err.message || 'Fehler beim Senden der Verifizierungs-E-Mail.');
            }
        } finally {
            setIsResending(false);
        }
    };

    const handleCheckVerification = async () => {
        setIsChecking(true);
        setError(null);
        try {
            await refreshUser();
            // If still not verified after refresh, show message
            // (If verified, App.tsx will automatically render the Dashboard)
        } catch (err: any) {
            setError('Fehler beim Überprüfen. Bitte versuchen Sie es erneut.');
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Animated Gradient Background — matches LoginPage */}
            <div className="absolute inset-0 bg-gradient-to-br from-aera-950 via-aera-900 to-aera-800" />

            {/* Animated Mesh / Grain Overlay */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 -left-1/4 w-[600px] h-[600px] bg-aera-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-0 -right-1/4 w-[500px] h-[500px] bg-emerald-400/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-teal-300/10 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
            </div>

            {/* Subtle Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />

            {/* Content */}
            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-6">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        AERA SCALE
                    </h1>
                    <p className="text-aera-200/70 mt-2 text-sm font-medium tracking-wide uppercase">
                        Property Intelligence Platform
                    </p>
                </div>

                {/* Glass Card */}
                <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] rounded-2xl shadow-2xl p-8">
                    {/* Mail Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-aera-500/20 border border-aera-400/30 flex items-center justify-center">
                            <Mail className="w-10 h-10 text-aera-300" />
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-white text-center mb-2">
                        E-Mail bestätigen
                    </h2>
                    <p className="text-white/60 text-sm text-center leading-relaxed mb-6">
                        Wir haben eine Bestätigungs-E-Mail an{' '}
                        <span className="text-aera-300 font-semibold">{user?.email}</span>{' '}
                        gesendet. Bitte klicken Sie auf den Link in der E-Mail.
                    </p>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Success Alert */}
                    {resendSuccess && (
                        <div className="mb-4 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-300">Verifizierungs-E-Mail wurde erneut gesendet!</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {/* Primary: Check Verification */}
                        <button
                            onClick={handleCheckVerification}
                            disabled={isChecking}
                            className="w-full py-3.5 bg-white text-aera-900 font-bold rounded-xl shadow-lg shadow-black/20 hover:bg-aera-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group text-sm"
                        >
                            {isChecking ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Wird überprüft...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                    <span>Ich habe meine E-Mail bestätigt</span>
                                </>
                            )}
                        </button>

                        {/* Secondary: Resend */}
                        <button
                            onClick={handleResend}
                            disabled={isResending || resendSuccess}
                            className="w-full py-3 bg-white/[0.06] border border-white/[0.1] text-white/80 font-medium rounded-xl hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                        >
                            {isResending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>E-Mail wird gesendet...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Verifizierungs-E-Mail erneut senden</span>
                                </>
                            )}
                        </button>

                        {/* Tertiary: Back to Login */}
                        <button
                            onClick={logout}
                            className="w-full py-3 text-white/40 font-medium rounded-xl hover:text-white/70 hover:bg-white/[0.04] transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Abmelden & zurück zur Anmeldung</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                        <Sparkles className="w-3 h-3" />
                        <span>Powered by Firebase & Vertex AI</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
