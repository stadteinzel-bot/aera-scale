import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { HOMEPAGE_BASE } from '../constants';
import { AlertCircle } from 'lucide-react';

const HOMEPAGE_URL = `${HOMEPAGE_BASE}/`;

/* ── Inline CSS injected once ─────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  /* Animations */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideIn  { from { opacity:0; transform:translateX(28px); } to { opacity:1; transform:translateX(0); } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes shake    { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.5} }

  .anim-fade   { animation: fadeUp  .55s cubic-bezier(.22,1,.36,1) both; }
  .anim-slide  { animation: slideIn .5s  cubic-bezier(.22,1,.36,1) both; }
  .anim-d1 { animation-delay: .08s; }
  .anim-d2 { animation-delay: .16s; }
  .anim-d3 { animation-delay: .24s; }
  .anim-d4 { animation-delay: .32s; }
  .anim-d5 { animation-delay: .40s; }
  .anim-d6 { animation-delay: .48s; }

  .shake { animation: shake .38s cubic-bezier(.36,.07,.19,.97); }
  .animate-spin { animation: spin .8s linear infinite; }

  /* Dot-grid pattern on left panel */
  .dot-grid {
    background-color: #022c22;
    background-image: radial-gradient(circle, rgba(201,168,76,.22) 1px, transparent 1px);
    background-size: 28px 28px;
  }

  /* Stat glassmorphism cards */
  .stat-card {
    background: rgba(255,255,255,.055);
    border: 1px solid rgba(201,168,76,.22);
    border-radius: 14px;
    padding: 16px 20px;
    backdrop-filter: blur(10px);
    display: flex; align-items: center; gap: 16px;
    transition: background .25s, border-color .25s;
  }
  .stat-card:hover {
    background: rgba(255,255,255,.09);
    border-color: rgba(201,168,76,.4);
  }
  .stat-icon {
    width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
    background: rgba(201,168,76,.12); border: 1px solid rgba(201,168,76,.25);
    display: flex; align-items: center; justify-content: center;
  }

  /* Pill tabs */
  .tab-pill {
    display: flex; background: #E8E2D9; border-radius: 40px; padding: 4px;
    margin-bottom: 28px; position: relative;
  }
  .tab-btn {
    flex: 1; padding: 9px 16px; font-size: 13px; font-weight: 500;
    border-radius: 36px; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all .22s cubic-bezier(.22,1,.36,1);
    background: transparent; color: #7A9589; position: relative; z-index: 1;
    letter-spacing: .02em;
  }
  .tab-btn.active {
    background: #022c22; color: #F5F0E8;
    box-shadow: 0 4px 14px rgba(2,44,34,.22);
  }

  /* Floating-label inputs */
  .input-group {
    position: relative;
  }
  .input-field {
    width: 100%; padding: 18px 16px 6px;
    border: 1.5px solid #D4CFC6; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 15px; color: #1A2E25;
    background: white; outline: none;
    transition: border-color .2s, box-shadow .2s;
    appearance: none; -webkit-appearance: none;
  }
  .input-field:focus {
    border-color: #C9A84C;
    box-shadow: 0 0 0 4px rgba(201,168,76,.12);
  }
  .input-label {
    position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
    font-family: 'DM Sans', sans-serif; font-size: 15px; color: #7A9589;
    pointer-events: none; transition: all .18s ease;
    transform-origin: left top;
  }
  .input-field:not(:placeholder-shown) ~ .input-label,
  .input-field:focus ~ .input-label {
    top: 8px; transform: translateY(0) scale(.75);
    color: #C9A84C; font-size: 13px;
  }

  /* Gold CTA button */
  .btn-gold {
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #C9A84C 0%, #dbb96a 100%);
    color: #022c22; border: none; border-radius: 12px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase;
    box-shadow: 0 8px 24px rgba(201,168,76,.35);
    transition: transform .2s, box-shadow .2s, opacity .2s;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .btn-gold:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(201,168,76,.45);
  }
  .btn-gold:active:not(:disabled) { transform: translateY(0); }
  .btn-gold:disabled { opacity: .7; cursor: not-allowed; }

  /* SSO buttons */
  .btn-sso {
    flex: 1; padding: 12px 10px;
    display: flex; align-items: center; justify-content: center; gap: 9px;
    border-radius: 12px; border: 1.5px solid #D4CFC6;
    background: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    color: #1A2E25; transition: all .2s;
  }
  .btn-sso:hover:not(:disabled) {
    border-color: #C9A84C;
    box-shadow: 0 4px 14px rgba(2,44,34,.08);
    background: #FAFAF8;
  }
  .btn-sso:disabled { opacity: .55; cursor: not-allowed; }
  .btn-sso-apple {
    background: #1d1d1f; color: #fff; border-color: #1d1d1f;
  }
  .btn-sso-apple:hover:not(:disabled) {
    background: #2d2d2f; border-color: #2d2d2f;
    box-shadow: 0 4px 14px rgba(0,0,0,.18);
  }

  /* Toggle (remember me) */
  .toggle {
    -webkit-appearance: none; appearance: none;
    width: 36px; height: 20px; background: #D4CFC6; border-radius: 10px;
    cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0;
  }
  .toggle::before {
    content: ''; position: absolute; width: 14px; height: 14px;
    border-radius: 50%; background: white; top: 3px; left: 3px;
    transition: transform .2s; box-shadow: 0 1px 4px rgba(0,0,0,.15);
  }
  .toggle:checked { background: #C9A84C; }
  .toggle:checked::before { transform: translateX(16px); }

  /* Error banner */
  .error-banner {
    display: flex; align-items: flex-start; gap: 9px;
    background: #FEF2F0; border: 1px solid #FBBFB5; border-radius: 10px;
    padding: 12px 14px; margin-bottom: 16px;
    animation: fadeUp .25s ease;
  }
  .warn-banner {
    display: flex; align-items: flex-start; gap: 9px;
    background: #FFF8EC; border: 1px solid rgba(201,168,76,.3); border-radius: 10px;
    padding: 12px 14px; margin-bottom: 20px;
    animation: fadeUp .25s ease;
  }

  /* Spinner */
  .spinner {
    width: 18px; height: 18px;
    border: 2.5px solid rgba(2,44,34,.25);
    border-top-color: #022c22;
    border-radius: 50%;
    animation: spin .7s linear infinite;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .login-left   { display: none !important; }
    .login-right  { width: 100% !important; min-height: 100vh; padding: 36px 24px !important; }
    .login-mobile-header { display: flex !important; }
  }
  .login-mobile-header { display: none; }
`;

/* ── SVG Logo Mark ──────────────────────────────────────────────────── */
const LogoMark: React.FC<{ size?: number; dark?: boolean }> = ({ size = 40, dark = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {dark ? (
      <>
        <rect x="8"  y="24" width="20" height="32" rx="2" fill="#2D4A3E" opacity="0.7"/>
        <rect x="16" y="12" width="32" height="44" rx="2" fill="#2D4A3E" opacity="0.4"/>
        <rect x="36" y="20" width="20" height="36" rx="2" fill="#2D4A3E" opacity="0.6"/>
      </>
    ) : (
      <>
        <rect x="8"  y="24" width="20" height="32" rx="2" fill="rgba(255,255,255,0.9)"/>
        <rect x="16" y="12" width="32" height="44" rx="2" fill="rgba(255,255,255,0.55)"/>
        <rect x="36" y="20" width="20" height="36" rx="2" fill="rgba(255,255,255,0.8)"/>
      </>
    )}
    <rect x="26" y="22" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="26" y="33" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="26" y="44" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="14" y="30" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="14" y="41" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="43" y="28" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="43" y="39" width="5" height="5" rx="1" fill="#C9A84C"/>
  </svg>
);

/* ── Google SVG ─────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ── Apple SVG ──────────────────────────────────────────────────────── */
const AppleIcon = () => (
  <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.5-317.3 99.8 0 182.6 65.8 244.9 65.8 59.2 0 152-69.1 265.8-69.1 42.1 0 152 3.9 227.3 87.4zM552.5 93.2c23-28.5 39.5-68.1 39.5-107.7 0-5.2-.5-10.5-1.3-15.6-37.8 1.4-83.1 25.3-110.6 57.2-21.1 23.5-40.3 63-40.3 103.2 0 5.8 1 11.5 1.4 13.3 2.3.4 6.1.7 9.4.7 34.2 0 76.3-22.9 101.9-51.1z"/>
  </svg>
);

/* ── Spinner ────────────────────────────────────────────────────────── */
const Spinner: React.FC<{ color?: string }> = ({ color = '#022c22' }) => (
  <div className="spinner" style={{ borderTopColor: color, borderColor: `${color}30` }} />
);

/* ══ Main Login Page ══════════════════════════════════════════════════ */
const LoginPage: React.FC = () => {
  const { login, register, loginWithGoogle, loginWithApple } = useAuth();
  const [ssoLoading, setSsoLoading] = useState<'google' | 'apple' | null>(null);
  const [isRegister, setIsRegister]           = useState(false);
  const [fromProtected, setFromProtected]     = useState(false);
  const [proPlan, setProPlan]                 = useState(false);
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [rememberMe, setRememberMe]           = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [shake, setShake]                     = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') setIsRegister(true);
    if (params.get('from') === 'protected') setFromProtected(true);
    if (params.get('plan') === 'pro') { setIsRegister(true); setProPlan(true); }
  }, []);

  const switchTab = (toRegister: boolean) => {
    setIsRegister(toRegister);
    setError(null);
    const params = new URLSearchParams(window.location.search);
    params.set('mode', toRegister ? 'register' : 'login');
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) { triggerShake('Bitte E-Mail und Passwort eingeben.'); return; }
    if (isRegister && password !== confirmPassword) { triggerShake('Passwörter stimmen nicht überein.'); return; }
    if (password.length < 6) { triggerShake('Passwort muss mindestens 6 Zeichen lang sein.'); return; }
    setIsLoading(true);
    try {
      if (isRegister) await register(email, password);
      else            await login(email, password);
    } catch (err: any) {
      const code = err?.code || '';
      if (['auth/user-not-found', 'auth/invalid-credential'].includes(code))
        triggerShake('Ungültige Anmeldedaten.');
      else if (code === 'auth/wrong-password')       triggerShake('Falsches Passwort.');
      else if (code === 'auth/email-already-in-use') triggerShake('E-Mail wird bereits verwendet.');
      else if (code === 'auth/invalid-email')        triggerShake('Ungültige E-Mail-Adresse.');
      else if (code === 'auth/too-many-requests')    triggerShake('Zu viele Versuche. Bitte warten.');
      else triggerShake(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSO = async (provider: 'google' | 'apple') => {
    setSsoLoading(provider);
    setError(null);
    try {
      if (provider === 'google') await loginWithGoogle();
      else await loginWithApple();
    } catch (err: any) {
      const msg = err?.code === 'auth/popup-closed-by-user'
        ? 'Anmeldung abgebrochen.'
        : err?.message || `${provider === 'google' ? 'Google' : 'Apple'}-Anmeldung fehlgeschlagen.`;
      triggerShake(msg);
    } finally {
      setSsoLoading(null);
    }
  };

  /* ── Left panel stats ─────────────────────────────────────────── */
  const stats = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      value: '1.240', label: 'Verwaltete Einheiten',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      value: '€ 24M', label: 'Portfolio-Gesamtwert',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      value: '98%', label: 'Kundenzufriedenheit',
    },
  ];

  return (
    <>
      {/* Inject styles */}
      <style>{STYLES}</style>

      <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '"DM Sans", sans-serif' }}>

        {/* ══ LEFT PANEL — Forest Green ══════════════════════════════ */}
        <div
          className="login-left dot-grid anim-fade"
          style={{
            width: '45%', minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Gold top accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #C9A84C 0%, rgba(201,168,76,.3) 60%, transparent 100%)' }} />

          {/* Dark overlay at bottom for depth */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(2,44,34,.6), transparent)', pointerEvents: 'none' }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 48px', position: 'relative', zIndex: 1 }}>

            {/* Logo */}
            <div className="anim-fade anim-d1" style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <LogoMark size={52} dark={false} />
                <div>
                  <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '20px', fontWeight: 700, color: '#F5F0E8', letterSpacing: '.1em' }}>AERA SCALE</div>
                  <div style={{ fontSize: '9px', letterSpacing: '.28em', textTransform: 'uppercase', color: '#C9A84C', marginTop: '2px' }}>Property Operating System</div>
                </div>
              </div>
            </div>

            {/* Headline */}
            <div className="anim-fade anim-d2" style={{ marginBottom: '52px' }}>
              <h1 style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 'clamp(36px, 4vw, 58px)',
                fontWeight: 600, color: 'white',
                lineHeight: 1.08, letterSpacing: '-.01em',
                marginBottom: '14px',
              }}>
                Immobilien.<br /><em style={{ color: '#E2C47A', fontStyle: 'italic' }}>Intelligent</em><br />verwaltet.
              </h1>
              <p style={{ color: 'rgba(245,240,232,.55)', fontSize: '15px', lineHeight: 1.7, maxWidth: '280px' }}>
                Die professionelle Lösung für modernes Immobilienmanagement.
              </p>
            </div>

            {/* Stat cards */}
            <div className="anim-fade anim-d3" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '310px' }}>
              {stats.map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '20px', fontWeight: 500, color: '#E2C47A', letterSpacing: '-.02em', lineHeight: 1 }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.5)', marginTop: '3px', letterSpacing: '.04em' }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              ))}

              {proPlan && (
                <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.28)', borderRadius: '10px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', display: 'block', flexShrink: 0 }} />
                  <span style={{ color: '#E2C47A', fontSize: '12px', fontWeight: 600 }}>Pro-Plan ausgewählt</span>
                </div>
              )}
            </div>
          </div>

          {/* Back link */}
          <a
            href={HOMEPAGE_URL}
            className="anim-fade anim-d4"
            style={{ padding: '20px 48px', fontSize: '12px', color: 'rgba(255,255,255,.3)', textDecoration: 'none', position: 'relative', zIndex: 1, transition: 'color .2s' }}
            onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,.6)')}
            onMouseOut={e  => (e.currentTarget.style.color = 'rgba(255,255,255,.3)')}
          >
            ← Zurück zur Website
          </a>
        </div>

        {/* ══ RIGHT PANEL — Cream ═══════════════════════════════════ */}
        <div
          className="login-right anim-slide"
          style={{
            width: '55%', background: '#F5F0E8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '48px 64px', position: 'relative', minHeight: '100vh',
          }}
        >
          {/* Subtle cream gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #F5F0E8 0%, #EDE7DB 100%)', pointerEvents: 'none' }} />

          <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>

            {/* Mobile header (hidden on desktop) */}
            <div className="login-mobile-header anim-fade anim-d1" style={{ alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <LogoMark size={32} dark />
              <span style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '18px', fontWeight: 700, color: '#1A2E25', letterSpacing: '.08em' }}>AERA SCALE</span>
            </div>

            {/* Heading */}
            <div className="anim-fade anim-d1" style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '38px', fontWeight: 700, color: '#022c22', marginBottom: '6px', lineHeight: 1.1 }}>
                {isRegister ? 'Konto erstellen' : 'Willkommen zurück'}
              </h2>
              <p style={{ fontSize: '15px', color: '#7A9589', lineHeight: 1.5 }}>
                {isRegister ? 'Starten Sie Ihr Immobilienportfolio.' : 'Ihr Portfolio wartet auf Sie.'}
              </p>
            </div>

            {/* Auth-required notice */}
            {fromProtected && (
              <div className="warn-banner">
                <AlertCircle size={14} style={{ color: '#C9A84C', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '13px', color: '#4A6358', margin: 0 }}>Bitte melden Sie sich an, um fortzufahren.</p>
              </div>
            )}

            {/* Pill tabs */}
            <div className="tab-pill anim-fade anim-d2">
              <button className={`tab-btn${!isRegister ? ' active' : ''}`} type="button" onClick={() => switchTab(false)}>
                Anmelden
              </button>
              <button className={`tab-btn${isRegister ? ' active' : ''}`} type="button" onClick={() => switchTab(true)}>
                Registrieren
              </button>
            </div>

            {/* Error banner */}
            {error && (
              <div className="error-banner">
                <AlertCircle size={14} style={{ color: '#C94A3A', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '13px', color: '#C94A3A', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className={shake ? 'shake' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Email */}
              <div className="input-group anim-fade anim-d3">
                <input
                  type="email"
                  id="email-field"
                  className="input-field"
                  placeholder=" "
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <label htmlFor="email-field" className="input-label">E-Mail Adresse</label>
              </div>

              {/* Password */}
              <div className="input-group anim-fade anim-d3" style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password-field"
                  className="input-field"
                  placeholder=" "
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  style={{ paddingRight: '48px' }}
                  required
                />
                <label htmlFor="password-field" className="input-label">Passwort</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A9589', padding: '4px' }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>

              {/* Confirm password */}
              {isRegister && (
                <div className="input-group anim-fade anim-d4">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirm-field"
                    className="input-field"
                    placeholder=" "
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <label htmlFor="confirm-field" className="input-label">Passwort bestätigen</label>
                </div>
              )}

              {/* Remember me / Forgot */}
              {!isRegister && (
                <div className="anim-fade anim-d4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#4A6358' }}>
                    <input
                      type="checkbox"
                      className="toggle"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                    />
                    Angemeldet bleiben
                  </label>
                  <a
                    href="#"
                    style={{ fontSize: '13px', color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}
                    onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseOut={e  => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Passwort vergessen?
                  </a>
                </div>
              )}

              {/* Register terms */}
              {isRegister && (
                <p className="anim-fade anim-d4" style={{ fontSize: '12px', color: '#7A9589', lineHeight: 1.6 }}>
                  Mit der Registrierung stimmen Sie unseren{' '}
                  <a href={`${HOMEPAGE_BASE}/agb.html`} target="_blank" rel="noopener" style={{ color: '#C9A84C', textDecoration: 'none' }}>AGB</a>
                  {' '}und der{' '}
                  <a href={`${HOMEPAGE_BASE}/datenschutz.html`} target="_blank" rel="noopener" style={{ color: '#C9A84C', textDecoration: 'none' }}>Datenschutzerklärung</a>
                  {' '}zu.
                </p>
              )}

              {/* CTA Button */}
              <div className="anim-fade anim-d4">
                <button
                  type="submit"
                  className="btn-gold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner color="#022c22" />
                      {isRegister ? 'Konto wird erstellt…' : 'Anmeldung…'}
                    </>
                  ) : (
                    <>
                      {isRegister ? 'Konto erstellen' : 'Jetzt anmelden'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="anim-fade anim-d5" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
                <span style={{ fontSize: '10px', color: '#7A9589', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase' }}>Oder</span>
                <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
              </div>

              {/* SSO buttons */}
              <div className="anim-fade anim-d5" style={{ display: 'flex', gap: '10px' }}>
                {/* Google — full width until Apple is configured */}
                <button
                  type="button"
                  className="btn-sso"
                  disabled={!!ssoLoading}
                  onClick={() => handleSSO('google')}
                  style={{ flex: 1 }}
                >
                  {ssoLoading === 'google' ? <Spinner color="#4285F4" /> : <GoogleIcon />}
                  <span>{ssoLoading === 'google' ? 'Laden…' : `Mit Google ${isRegister ? 'registrieren' : 'anmelden'}`}</span>
                </button>
              </div>
            </form>

            {/* Footer links */}
            <div className="anim-fade anim-d6" style={{ marginTop: '32px', paddingTop: '18px', borderTop: '1px solid #D4CFC6', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#7A9589' }}>
                <a href={`${HOMEPAGE_BASE}/datenschutz.html`} target="_blank" rel="noopener" style={{ color: '#7A9589', textDecoration: 'none' }}
                   onMouseOver={e => (e.currentTarget.style.color = '#C9A84C')}
                   onMouseOut={e  => (e.currentTarget.style.color = '#7A9589')}>Datenschutz</a>
                {' · '}
                <a href={`${HOMEPAGE_BASE}/agb.html`} target="_blank" rel="noopener" style={{ color: '#7A9589', textDecoration: 'none' }}
                   onMouseOver={e => (e.currentTarget.style.color = '#C9A84C')}
                   onMouseOut={e  => (e.currentTarget.style.color = '#7A9589')}>AGB</a>
                {' · '}
                <a href={`${HOMEPAGE_BASE}/impressum.html`} target="_blank" rel="noopener" style={{ color: '#7A9589', textDecoration: 'none' }}
                   onMouseOver={e => (e.currentTarget.style.color = '#C9A84C')}
                   onMouseOut={e  => (e.currentTarget.style.color = '#7A9589')}>Impressum</a>
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
