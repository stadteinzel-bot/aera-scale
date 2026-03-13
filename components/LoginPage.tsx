import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { AlertCircle } from 'lucide-react';

const HOMEPAGE_URL = 'https://stadteinzel-bot.github.io/aera-scale/homepage/';

// ── SVG Logo Mark ──────────────────────────────────────────────────
const LogoMark: React.FC<{ size?: number; dark?: boolean }> = ({ size = 40, dark = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {dark ? (
      // Dark version for cream panel
      <>
        <rect x="8"  y="24" width="20" height="32" rx="2" fill="#2D4A3E" opacity="0.7"/>
        <rect x="16" y="12" width="32" height="44" rx="2" fill="#2D4A3E" opacity="0.4"/>
        <rect x="36" y="20" width="20" height="36" rx="2" fill="#2D4A3E" opacity="0.6"/>
      </>
    ) : (
      // White version for forest panel
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

// ── Login Page Component ───────────────────────────────────────────
const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '"DM Sans", sans-serif' }}>

      {/* ══ LEFT PANEL — Forest Green (55%) ══════════════════════ */}
      <div
        className="geo-pattern anim-fade"
        style={{
          width: '55%', minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '60px 48px', position: 'relative',
        }}
      >
        {/* Top gold accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #C9A84C, transparent)' }} />

        {/* Logo */}
        <div className="anim-fade anim-d1" style={{ marginBottom: '40px', textAlign: 'center' }}>
          <LogoMark size={64} dark={false} />
        </div>

        {/* Headline */}
        <div className="anim-fade anim-d2" style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h1 style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 'clamp(40px, 5vw, 60px)',
            fontWeight: 700, color: 'white',
            lineHeight: 1.05, letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}>
            Immobilien.<br />Intelligent<br />verwaltet.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', lineHeight: 1.65, maxWidth: '300px' }}>
            Die professionelle Lösung für modernes Immobilienmanagement.
          </p>
        </div>

        {/* Stats */}
        <div className="anim-fade anim-d3" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
          {[
            { value: '1.240', label: 'Verwaltete Objekte' },
            { value: '€ 24M', label: 'Portfolio-Gesamtwert' },
            { value: '98%',   label: 'Kundenzufriedenheit' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '22px', fontWeight: 500, color: '#E2C47A', letterSpacing: '-0.02em' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '3px' }}>
                {s.label}
              </div>
            </div>
          ))}

          {proPlan && (
            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', display: 'block' }} />
              <span style={{ color: '#E2C47A', fontSize: '12px', fontWeight: 600 }}>Pro-Plan ausgewählt</span>
            </div>
          )}
        </div>

        {/* Back link */}
        <a
          href={HOMEPAGE_URL}
          className="anim-fade anim-d4"
          style={{ position: 'absolute', bottom: '28px', left: '48px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
          onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          onMouseOut={e  => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          ← Zurück zur Website
        </a>
      </div>

      {/* ══ RIGHT PANEL — Cream (45%) ═════════════════════════════ */}
      <div
        className="anim-slide"
        style={{
          width: '45%', background: '#F5F0E8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 56px', position: 'relative',
        }}
      >
        {/* Top gold accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #C9A84C, transparent)' }} />

        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* Logo small */}
          <div className="anim-fade anim-d1" style={{ marginBottom: '36px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LogoMark size={32} dark />
            <span style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '20px', fontWeight: 700, color: '#1A2E25', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Aera Scale
            </span>
          </div>

          {/* Auth-required notice */}
          {fromProtected && (
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#FFF8EC', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '10px', padding: '12px 14px' }}>
              <AlertCircle size={14} style={{ color: '#C9A84C', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '13px', color: '#4A6358', margin: 0 }}>Bitte melden Sie sich an, um fortzufahren.</p>
            </div>
          )}

          {/* Headline */}
          <div className="anim-fade anim-d2" style={{ marginBottom: '32px' }}>
            <h2 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '38px', fontWeight: 700, color: '#1A2E25', marginBottom: '6px', lineHeight: 1.1 }}>
              {isRegister ? 'Konto erstellen' : 'Willkommen zurück'}
            </h2>
            <p style={{ fontSize: '15px', color: '#7A9589' }}>
              {isRegister ? 'Starten Sie Ihr Immobilienportfolio.' : 'Ihr Portfolio wartet auf Sie.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="anim-fade anim-d2" style={{ display: 'flex', background: '#EDE8DF', borderRadius: '12px', padding: '4px', marginBottom: '28px' }}>
            {(['Anmelden', 'Registrieren'] as const).map((tab, i) => {
              const active = i === 0 ? !isRegister : isRegister;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => switchTab(i === 1)}
                  style={{
                    flex: 1, padding: '8px', fontSize: '14px', fontWeight: 600,
                    borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontFamily: '"DM Sans", sans-serif',
                    transition: 'all 200ms ease-out',
                    background: active ? 'white' : 'transparent',
                    color: active ? '#1A2E25' : '#7A9589',
                    boxShadow: active ? '0 1px 3px rgba(45,74,62,0.1)' : 'none',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#FEF2F0', border: '1px solid #FBBFB5', borderRadius: '8px', padding: '10px 14px' }}>
              <AlertCircle size={14} style={{ color: '#C94A3A', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '13px', color: '#C94A3A', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={shake ? 'shake' : ''}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* Email */}
            <div className="anim-fade anim-d3 input-group">
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
            <div className="anim-fade anim-d3 input-group" style={{ position: 'relative' }}>
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
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Confirm password */}
            {isRegister && (
              <div className="input-group">
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
              <div className="anim-fade anim-d3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  onMouseOver={e => (e.currentTarget.style.color = '#A6883A')}
                  onMouseOut={e  => (e.currentTarget.style.color = '#C9A84C')}
                >
                  Passwort vergessen?
                </a>
              </div>
            )}

            {/* CTA */}
            <div className="anim-fade anim-d4">
              <button
                type="submit"
                className="btn-gold"
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : undefined }}
              >
                {isLoading
                  ? (isRegister ? 'Konto wird erstellt…' : 'Anmeldung…')
                  : (isRegister ? 'Konto erstellen →' : 'Jetzt anmelden →')}
              </button>
            </div>

            {/* Divider */}
            {!isRegister && (
              <>
                <div className="anim-fade anim-d4" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
                  <span style={{ fontSize: '11px', color: '#7A9589', fontWeight: 600, letterSpacing: '0.05em' }}>ODER</span>
                  <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
                </div>

                {/* SSO buttons */}
                <div className="anim-fade anim-d5" style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn-sso">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" className="btn-sso">
                    <svg width="16" height="16" viewBox="0 0 21 21">
                      <rect x="0"  y="0"  width="10" height="10" fill="#F25022"/>
                      <rect x="11" y="0"  width="10" height="10" fill="#7FBA00"/>
                      <rect x="0"  y="11" width="10" height="10" fill="#00A4EF"/>
                      <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
                    </svg>
                    Microsoft
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Footer links */}
          <div className="anim-fade anim-d5" style={{ marginTop: '36px', paddingTop: '18px', borderTop: '1px solid #D4CFC6', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#7A9589' }}>
              <a href="/homepage/datenschutz.html" style={{ color: '#7A9589', textDecoration: 'none' }}>Datenschutz</a>
              {' · '}
              <a href="/homepage/agb.html" style={{ color: '#7A9589', textDecoration: 'none' }}>AGB</a>
              {' · '}
              <a href="/homepage/impressum.html" style={{ color: '#7A9589', textDecoration: 'none' }}>Impressum</a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
