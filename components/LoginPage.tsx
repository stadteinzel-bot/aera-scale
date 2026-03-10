import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { Building2, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
    const { login, register } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password.trim()) {
            setError('Bitte E-Mail und Passwort eingeben.');
            return;
        }

        if (isRegister && password !== confirmPassword) {
            setError('Passwörter stimmen nicht überein.');
            return;
        }

        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }

        setIsLoading(true);
        try {
            if (isRegister) {
                await register(email, password);
            } else {
                await login(email, password);
            }
        } catch (err: any) {
            const code = err?.code || '';
            if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
                setError('Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.');
            } else if (code === 'auth/wrong-password') {
                setError('Falsches Passwort.');
            } else if (code === 'auth/email-already-in-use') {
                setError('Diese E-Mail wird bereits verwendet.');
            } else if (code === 'auth/invalid-email') {
                setError('Ungültige E-Mail-Adresse.');
            } else if (code === 'auth/too-many-requests') {
                setError('Zu viele Versuche. Bitte warten Sie einen Moment.');
            } else {
                setError(err.message || 'Ein Fehler ist aufgetreten.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Animated Gradient Background */}
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

            {/* Login Card */}
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

                    {/* Toggle: Login / Register */}
                    <div className="flex bg-white/[0.06] rounded-xl p-1 mb-8">
                        <button
                            type="button"
                            onClick={() => { setIsRegister(false); setError(null); }}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${!isRegister
                                    ? 'bg-white text-aera-900 shadow-md'
                                    : 'text-white/60 hover:text-white/90'
                                }`}
                        >
                            Anmelden
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsRegister(true); setError(null); }}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${isRegister
                                    ? 'bg-white text-aera-900 shadow-md'
                                    : 'text-white/60 hover:text-white/90'
                                }`}
                        >
                            Registrieren
                        </button>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                E-Mail
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@unternehmen.de"
                                    className="w-full pl-11 pr-4 py-3.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-aera-400/40 focus:border-aera-400/40 transition-all"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                Passwort
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-11 pr-12 py-3.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-aera-400/40 focus:border-aera-400/40 transition-all"
                                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password (Register only) */}
                        {isRegister && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                                    Passwort bestätigen
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-11 pr-4 py-3.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-aera-400/40 focus:border-aera-400/40 transition-all"
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 bg-white text-aera-900 font-bold rounded-xl shadow-lg shadow-black/20 hover:bg-aera-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group text-sm"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{isRegister ? 'Konto wird erstellt...' : 'Anmeldung...'}</span>
                                </>
                            ) : (
                                <>
                                    <span>{isRegister ? 'Konto erstellen' : 'Anmelden'}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
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

export default LoginPage;
