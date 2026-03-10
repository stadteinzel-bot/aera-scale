/**
 * ===== AERA SCALE — Two-Factor Authentication (2FA) Settings =====
 * 
 * Allows users to enable/disable TOTP-based 2FA via Firebase MFA.
 * Shows enrollment status, verification flow, and unenrollment.
 * 
 * Note: Firebase MFA with TOTP requires the Identity Platform upgrade.
 * If not available, the component gracefully degrades with an info message.
 */

import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Smartphone, CheckCircle2, AlertCircle, Loader2, X, Copy, Key } from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import {
    multiFactor,
    TotpMultiFactorGenerator,
    TotpSecret,
    getMultiFactorResolver,
} from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

const TwoFactorSettings: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const [step, setStep] = useState<'idle' | 'enrolling' | 'verifying' | 'unenrolling'>('idle');
    const [secret, setSecret] = useState<TotpSecret | null>(null);
    const [qrUri, setQrUri] = useState<string>('');
    const [secretKey, setSecretKey] = useState<string>('');
    const [verificationCode, setVerificationCode] = useState('');
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Check if 2FA is already enrolled
    const mfaUser = user ? multiFactor(user) : null;
    const enrolledFactors = mfaUser?.enrolledFactors || [];
    const is2FAEnabled = enrolledFactors.length > 0;
    const totpFactor = enrolledFactors.find(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);

    const handleStartEnrollment = async () => {
        if (!user || !mfaUser) return;
        setError('');
        setLoading(true);

        try {
            // Generate TOTP secret
            const session = await mfaUser.getSession();
            const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);

            setSecret(totpSecret);
            setSecretKey(totpSecret.secretKey);
            setQrUri(totpSecret.generateQrCodeUrl(user.email || 'AERA SCALE', 'AERA SCALE'));
            setStep('enrolling');
        } catch (e: any) {
            console.error('2FA enrollment start error:', e);
            if (e.code === 'auth/unsupported-first-factor' || e.code === 'auth/operation-not-allowed') {
                setError('2FA ist für dieses Projekt noch nicht aktiviert. Bitte aktivieren Sie Identity Platform in der Firebase Console.');
            } else {
                setError(e.message || 'Fehler beim Starten der 2FA-Einrichtung.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndEnroll = async () => {
        if (!secret || !mfaUser || verificationCode.length !== 6) return;
        setError('');
        setLoading(true);

        try {
            const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, verificationCode);
            await mfaUser.enroll(assertion, 'TOTP Authenticator');
            setSuccess('2FA wurde erfolgreich aktiviert!');
            setStep('idle');
            setVerificationCode('');
            setSecret(null);
            await refreshUser();
        } catch (e: any) {
            console.error('2FA verification error:', e);
            if (e.code === 'auth/invalid-verification-code') {
                setError('Falscher Code. Bitte versuchen Sie es erneut.');
            } else {
                setError(e.message || 'Verifizierung fehlgeschlagen.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUnenroll = async () => {
        if (!mfaUser || !totpFactor) return;
        setError('');
        setLoading(true);

        try {
            await mfaUser.unenroll(totpFactor);
            setSuccess('2FA wurde deaktiviert.');
            setStep('idle');
            await refreshUser();
        } catch (e: any) {
            console.error('2FA unenroll error:', e);
            setError(e.message || 'Fehler beim Deaktivieren der 2FA.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-violet-900 to-indigo-800 text-white">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Shield className="w-5 h-5 text-violet-200" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Zwei-Faktor-Authentifizierung</h2>
                        <p className="text-violet-200 text-sm">Sichern Sie Ihr Konto mit TOTP (z.B. Google Authenticator)</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-4">
                {/* Status Display */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${is2FAEnabled
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                    {is2FAEnabled ? (
                        <>
                            <ShieldCheck className="w-6 h-6 text-emerald-600" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-800">2FA ist aktiv</p>
                                <p className="text-xs text-emerald-600">Ihr Konto ist durch einen zweiten Faktor geschützt.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <ShieldAlert className="w-6 h-6 text-amber-600" />
                            <div>
                                <p className="text-sm font-semibold text-amber-800">2FA ist nicht aktiv</p>
                                <p className="text-xs text-amber-600">Aktivieren Sie 2FA für zusätzliche Sicherheit.</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        {success}
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Enrollment Flow */}
                {step === 'enrolling' && qrUri && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <p className="text-sm font-medium text-slate-700 mb-3">
                                1. Scannen Sie diesen QR-Code mit Ihrer Authenticator-App:
                            </p>
                            <div className="flex justify-center mb-4">
                                <div className="bg-white p-4 rounded-lg shadow-inner">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                                        alt="2FA QR Code"
                                        className="w-48 h-48"
                                    />
                                </div>
                            </div>

                            {/* Manual key */}
                            <div className="mt-4">
                                <p className="text-xs text-slate-500 mb-1">Oder geben Sie diesen Schlüssel manuell ein:</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 truncate">
                                        {secretKey}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(secretKey)}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                                        title="Kopieren"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Verification */}
                        <div>
                            <p className="text-sm font-medium text-slate-700 mb-2">
                                2. Geben Sie den 6-stelligen Code ein:
                            </p>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={verificationCode}
                                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    maxLength={6}
                                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-aera-500 focus:border-transparent"
                                />
                                <button
                                    onClick={handleVerifyAndEnroll}
                                    disabled={verificationCode.length !== 6 || loading}
                                    className="px-6 py-3 bg-aera-600 text-white rounded-xl text-sm font-medium hover:bg-aera-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Aktivieren
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => { setStep('idle'); setSecret(null); setVerificationCode(''); setError(''); }}
                            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            Abbrechen
                        </button>
                    </div>
                )}

                {/* Action Buttons */}
                {step === 'idle' && (
                    <div className="flex gap-3 pt-2">
                        {is2FAEnabled ? (
                            <button
                                onClick={handleUnenroll}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                                2FA deaktivieren
                            </button>
                        ) : (
                            <button
                                onClick={handleStartEnrollment}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-aera-600 text-white rounded-xl text-sm font-medium hover:bg-aera-500 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                2FA aktivieren
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TwoFactorSettings;
