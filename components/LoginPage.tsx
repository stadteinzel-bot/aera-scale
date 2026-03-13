import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const HOMEPAGE_URL = 'https://stadteinzel-bot.github.io/aera-scale/homepage/';

const LogoMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" rx="10" fill="rgba(255,255,255,0.12)"/>
    <g transform="translate(4,4)">
      <rect x="10" y="28" width="7" height="24" fill="#C9A84C"/>
      <rect x="39" y="28" width="7" height="24" fill="#C9A84C"/>
      <polygon points="13,28 28,8 31,8 31,14 16,32" fill="#C9A84C"/>
      <polygon points="43,28 28,8 25,8 25,14 40,32" fill="#C9A84C"/>
      <rect x="18" y="36" width="20" height="5" fill="#C9A84C"/>
    </g>
  </svg>
);

const FEATURES = [
  { label: 'KI-Vertragsanalyse & Lease AI' },
  { label: 'Open Banking — PSD2 Integration' },
  { label: 'Ab € 20 / Einheit · Skalierbar bis 500+' },
];

const LoginPage: React.FC = () => {
    const { login, register } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [fromProtected, setFromProtected] = useState(false);
    const [proPlan, setProPlan] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        const from = params.get('from');
        const plan = params.get('plan');
        if (mode === 'register') setIsRegister(true);
        if (from === 'protected') setFromProtected(true);
        if (plan === 'pro') { setIsRegister(true); setProPlan(true); }
    }, []);

    const switchTab = (toRegister: boolean) => {
        setIsRegister(toRegister);
        setError(null);
        const params = new URLSearchParams(window.location.search);
        params.set('mode', toRegister ? 'register' : 'login');
        window.history.replaceState({}, '', `?${params.toString()}`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email.trim() || !password.trim()) { setError('Bitte E-Mail und Passwort eingeben.'); return; }
        if (isRegister && password !== confirmPassword) { setError('Passwörter stimmen nicht überein.'); return; }
        if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return; }
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
        <div className="min-h-screen flex">

            {/* ── LEFT: Brand Panel ── */}
            <div className="hidden lg:flex lg:w-1/2 bg-aera-900 flex-col justify-between p-12">
                <div className="flex items-center gap-3">
                    <LogoMark size={40} />
                    <div>
                        <div className="text-white font-bold text-lg tracking-widest leading-none">AERA SCALE</div>
                        <div className="text-gold-500 text-[10px] tracking-[0.25em] font-medium uppercase mt-0.5">Property Operating System</div>
                    </div>
                </div>

                <div>
                    <h2 className="text-white text-4xl font-semibold leading-tight mb-8">
                        Jede Einheit.<br />
                        Intelligent<br />
                        verwaltet.
                    </h2>
                    <div className="space-y-4">
                        {FEATURES.map((f) => (
                            <div key={f.label} className="flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4 text-gold-500 shrink-0" />
                                <span className="text-aera-200/80 text-sm font-medium">{f.label}</span>
                            </div>
                        ))}
                        {proPlan && (
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                                <span className="w-2 h-2 rounded-full bg-gold-500" />
                                <span className="text-gold-400 text-xs font-semibold">Pro-Plan ausgewählt</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-12 grid grid-cols-3 gap-4">
                        {[
                            { value: '500+', label: 'Einheiten' },
                            { value: '€ 20', label: 'ab / Einheit' },
                            { value: '99.9%', label: 'Verfügbarkeit' },
                        ].map((k) => (
                            <div key={k.label} className="bg-aera-800/60 border border-aera-700/60 rounded-xl p-3 text-center">
                                <div className="text-gold-400 font-bold text-lg leading-none">{k.value}</div>
                                <div className="text-aera-400/70 text-[10px] mt-1 uppercase tracking-wider">{k.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <a href={HOMEPAGE_URL} className="text-aera-500 text-xs hover:text-aera-300 transition-colors">
                    ← Zurück zur Website
                </a>
            </div>

            {/* ── RIGHT: Auth Panel ── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 py-12">
                <div className="w-full max-w-sm">

                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 mb-8">
                        <LogoMark size={32} />
                        <span className="text-aera-900 font-bold text-base tracking-widest">AERA SCALE</span>
                    </div>

                    {fromProtected && (
                        <div className="mb-6 flex items-start gap-2 bg-aera-50 border border-aera-200 rounded-xl p-3.5">
                            <AlertCircle className="w-4 h-4 text-aera-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-aera-700">Bitte melden Sie sich an, um fortzufahren.</p>
                        </div>
                    )}

                    <h1 className="text-2xl font-semibold text-aera-900 mb-1">
                        {isRegister ? 'Konto erstellen' : 'Willkommen zurück'}
                    </h1>
                    <p className="text-slate-500 text-sm mb-8">
                        {isRegister
                            ? 'Erstellen Sie Ihr AERA SCALE Konto.'
                            : 'Melden Sie sich bei Ihrem Konto an.'}
                    </p>

                    {/* Tab switcher */}
                    <div className="flex border border-slate-200 rounded-xl p-1 mb-7 bg-slate-50">
                        <button type="button" onClick={() => switchTab(false)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isRegister
                                ? 'bg-white text-aera-900 shadow-sm border border-slate-200'
                                : 'text-slate-400 hover:text-slate-600'}`}>
                            Anmelden
                        </button>
                        <button type="button" onClick={() => switchTab(true)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isRegister
                                ? 'bg-white text-aera-900 shadow-sm border border-slate-200'
                                : 'text-slate-400 hover:text-slate-600'}`}>
                            Registrieren
                        </button>
                    </div>

                    {error && (
                        <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">E-Mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@unternehmen.de"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm text-aera-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all bg-white"
                                    autoComplete="email" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Passwort</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                                    className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm text-aera-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all bg-white"
                                    autoComplete={isRegister ? 'new-password' : 'current-password'} required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {isRegister && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Passwort bestätigen</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm text-aera-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all bg-white"
                                        autoComplete="new-password" required />
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={isLoading}
                            className="w-full py-3 bg-aera-900 text-white font-semibold rounded-xl hover:bg-aera-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 group mt-2">
                            {isLoading
                                ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>{isRegister ? 'Konto wird erstellt…' : 'Anmeldung…'}</span></>)
                                : (<><span>{isRegister ? 'Konto erstellen' : 'Anmelden'}</span><ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>)
                            }
                        </button>
                    </form>

                    <p className="text-center text-slate-400 text-xs mt-8">Powered by Firebase &amp; Vertex AI</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
