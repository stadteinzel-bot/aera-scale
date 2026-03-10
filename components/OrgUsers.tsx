// ===== AERA SCALE — Organisation & Benutzerverwaltung =====
// Premium redesign: Org profile, member management, invite flow

import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, UserPlus, Shield, ShieldCheck, ShieldAlert, Mail, MoreVertical,
    Loader2, Check, X, AlertCircle, Clock, UserX, Building2, Crown,
    Briefcase, BarChart3, Copy, Search, ArrowUpDown, ChevronRight,
    UserCheck, Sparkles, Key, Globe, LogOut, Trash2, TriangleAlert
} from 'lucide-react';
import { useOrg } from '../services/OrgContext';
import { useAuth } from '../services/AuthContext';
import { dataService } from '../services/dataService';
import { isValidEmail } from '../utils/validation';
import { deleteAccount } from '../services/bankingService';
import type { OrgMember, OrgRole, MemberStatus } from '../types';

// ── Role Configuration ──
const ROLES: { id: OrgRole; label: string; description: string; icon: React.FC<any>; gradient: string; badgeBg: string; badgeText: string; avatarBg: string; avatarText: string }[] = [
    {
        id: 'org_admin', label: 'Administrator', description: 'Vollzugriff auf alle Bereiche',
        icon: Crown, gradient: 'from-amber-500 to-orange-500',
        badgeBg: 'bg-amber-50', badgeText: 'text-amber-700',
        avatarBg: 'bg-gradient-to-br from-amber-400 to-orange-500', avatarText: 'text-white',
    },
    {
        id: 'finance', label: 'Finanzen', description: 'Rechnungen, Zahlungen, Abgleich',
        icon: BarChart3, gradient: 'from-emerald-500 to-teal-500',
        badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700',
        avatarBg: 'bg-gradient-to-br from-emerald-400 to-teal-500', avatarText: 'text-white',
    },
    {
        id: 'property_manager', label: 'Objektverwalter', description: 'Immobilien, Mieter, Wartung',
        icon: Building2, gradient: 'from-blue-500 to-indigo-500',
        badgeBg: 'bg-blue-50', badgeText: 'text-blue-700',
        avatarBg: 'bg-gradient-to-br from-blue-400 to-indigo-500', avatarText: 'text-white',
    },
    {
        id: 'user', label: 'Benutzer', description: 'Basis-Lesezugriff',
        icon: Users, gradient: 'from-slate-400 to-slate-500',
        badgeBg: 'bg-slate-100', badgeText: 'text-slate-600',
        avatarBg: 'bg-gradient-to-br from-slate-300 to-slate-400', avatarText: 'text-white',
    },
];

const getRoleConfig = (role: OrgRole) => ROLES.find(r => r.id === role) || ROLES[3];

const STATUS_CONFIG: Record<MemberStatus, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
    active: { label: 'Aktiv', dotColor: 'bg-emerald-400', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
    pending: { label: 'Ausstehend', dotColor: 'bg-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
    deactivated: { label: 'Deaktiviert', dotColor: 'bg-red-400', bgColor: 'bg-red-50', textColor: 'text-red-600' },
};

const OrgUsers: React.FC = () => {
    const { orgId, org, isOrgAdmin, member: currentMember } = useOrg();
    const { user, logout } = useAuth();
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<OrgRole | 'all'>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Danger zone state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteEmailInput, setDeleteEmailInput] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Invite form
    const [invEmail, setInvEmail] = useState('');
    const [invName, setInvName] = useState('');
    const [invRole, setInvRole] = useState<OrgRole>('user');
    const [inviting, setInviting] = useState(false);
    const [invSuccess, setInvSuccess] = useState(false);
    const [invEmailError, setInvEmailError] = useState('');

    const loadMembers = useCallback(async () => {
        setIsLoading(true);
        let m = await dataService.getOrgMembers(orgId);
        if (m.length === 0 && currentMember && user) {
            m = [{
                ...currentMember,
                uid: user.uid,
                email: user.email || currentMember.email || '',
                displayName: user.displayName || currentMember.displayName || user.email?.split('@')[0] || 'User',
            }];
        }
        setMembers(m);
        setIsLoading(false);
    }, [orgId, currentMember, user]);

    useEffect(() => { loadMembers(); }, [loadMembers]);

    // Close menu on outside click
    useEffect(() => {
        if (!activeMenu) return;
        const handler = () => setActiveMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [activeMenu]);

    const handleInvite = async () => {
        if (!invEmail.trim()) return;
        if (!isValidEmail(invEmail.trim())) {
            setInvEmailError('Bitte eine gültige E-Mail-Adresse eingeben.');
            return;
        }
        setInvEmailError('');
        setInviting(true);
        try {
            const placeholderId = `invite_${Date.now()}`;
            const memberDoc: OrgMember = {
                uid: placeholderId,
                email: invEmail.trim().toLowerCase(),
                displayName: invName.trim() || invEmail.split('@')[0],
                role: invRole,
                status: 'pending',
                invitedAt: new Date().toISOString(),
                invitedBy: user?.uid || '',
            };
            await dataService.createInvite(orgId, { ...memberDoc, uid: placeholderId });
            await dataService.addAuditLog({
                action: 'User eingeladen',
                user: user?.email || '',
                details: `${invEmail} als ${getRoleConfig(invRole).label} eingeladen`,
                propertyId: '',
            });
            setInvSuccess(true);
            setTimeout(() => {
                setShowInvite(false);
                setInvEmail('');
                setInvName('');
                setInvRole('user');
                setInvSuccess(false);
            }, 2000);
            loadMembers();
        } catch (e) {
            console.error('Invite error:', e);
        } finally {
            setInviting(false);
        }
    };

    const handleRoleChange = async (member: OrgMember, newRole: OrgRole) => {
        try {
            await dataService.updateOrgMember(orgId, member.uid, { role: newRole });
            await dataService.addAuditLog({
                action: 'Rolle geändert',
                user: user?.email || '',
                details: `${member.email}: ${getRoleConfig(member.role).label} → ${getRoleConfig(newRole).label}`,
                propertyId: '',
            });
            setActiveMenu(null);
            loadMembers();
        } catch (e) {
            console.error('Role change error:', e);
        }
    };

    const handleToggleStatus = async (member: OrgMember) => {
        const newStatus: MemberStatus = member.status === 'deactivated' ? 'active' : 'deactivated';
        try {
            await dataService.updateOrgMember(orgId, member.uid, { status: newStatus });
            await dataService.addAuditLog({
                action: newStatus === 'deactivated' ? 'User deaktiviert' : 'User reaktiviert',
                user: user?.email || '',
                details: `${member.email} → ${newStatus}`,
                propertyId: '',
            });
            setActiveMenu(null);
            loadMembers();
        } catch (e) {
            console.error('Status toggle error:', e);
        }
    };

    const handleCopyOrgId = () => {
        navigator.clipboard.writeText(orgId);
        setCopiedId(orgId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Stats
    const activeCount = members.filter(m => m.status === 'active').length;
    const pendingCount = members.filter(m => m.status === 'pending').length;
    const adminCount = members.filter(m => m.role === 'org_admin' && m.status === 'active').length;

    // Filtering
    const filtered = members.filter(m => {
        const matchSearch = !search || m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = filterRole === 'all' || m.role === filterRole;
        return matchSearch && matchRole;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ═══ ORG PROFILE CARD ═══ */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-aera-950 via-aera-900 to-aera-800 text-white shadow-xl">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-aera-500/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/4" />

                <div className="relative p-8">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                                <Building2 className="w-8 h-8 text-aera-300" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">{org.name}</h2>
                                <div className="flex items-center gap-3 mt-2 text-sm text-aera-200/80">
                                    <span className="flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5" />
                                        AERA SCALE Platform
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-aera-400/40" />
                                    <span>Erstellt {new Date(org.createdAt).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCopyOrgId}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-aera-200 transition-all border border-white/10 backdrop-blur-sm"
                            title="Org-ID kopieren"
                        >
                            <Key className="w-3 h-3" />
                            <span className="font-mono">{orgId.substring(0, 12)}…</span>
                            {copiedId === orgId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-aera-300/70 text-xs font-medium mb-1">
                                <Users className="w-3.5 h-3.5" /> Mitglieder
                            </div>
                            <p className="text-3xl font-bold">{members.length}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-emerald-300/70 text-xs font-medium mb-1">
                                <UserCheck className="w-3.5 h-3.5" /> Aktiv
                            </div>
                            <p className="text-3xl font-bold text-emerald-300">{activeCount}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-amber-300/70 text-xs font-medium mb-1">
                                <Clock className="w-3.5 h-3.5" /> Ausstehend
                            </div>
                            <p className="text-3xl font-bold text-amber-300">{pendingCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ MEMBER MANAGEMENT ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Mitglied suchen…"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aera-500/20 focus:border-aera-400 transition-all placeholder:text-slate-400"
                            />
                        </div>
                        <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value as OrgRole | 'all')}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-aera-500/20 cursor-pointer"
                        >
                            <option value="all">Alle Rollen</option>
                            {ROLES.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    {isOrgAdmin && (
                        <button
                            onClick={() => setShowInvite(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-aera-700 to-aera-800 text-white rounded-xl text-sm font-semibold hover:from-aera-600 hover:to-aera-700 transition-all shadow-md shadow-aera-500/10 active:scale-[0.98]"
                        >
                            <UserPlus className="w-4 h-4" />
                            Benutzer einladen
                        </button>
                    )}
                </div>

                {/* Member Table */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-3 border-aera-200 border-t-aera-600 rounded-full animate-spin" />
                        <p className="mt-4 text-sm text-slate-400">Mitglieder werden geladen…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-medium text-slate-500">Keine Mitglieder gefunden</p>
                        <p className="text-sm mt-1">{search ? 'Versuchen Sie eine andere Suche' : 'Laden Sie Teammitglieder ein'}</p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            <span>Mitglied</span>
                            <span className="w-32 text-center">Rolle</span>
                            <span className="w-24 text-center">Status</span>
                            <span className="w-12" />
                        </div>

                        {/* Member Rows */}
                        <div className="divide-y divide-slate-100/80">
                            {filtered.map(m => {
                                const roleCfg = getRoleConfig(m.role);
                                const statusCfg = STATUS_CONFIG[m.status];
                                const isCurrentUser = m.uid === user?.uid;
                                const menuOpen = activeMenu === m.uid;
                                const RoleIcon = roleCfg.icon;

                                return (
                                    <div
                                        key={m.uid}
                                        className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 items-center px-6 py-4 group transition-all duration-200 hover:bg-slate-50/50 ${m.status === 'deactivated' ? 'opacity-50' : ''}`}
                                    >
                                        {/* Avatar + Info */}
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-11 h-11 rounded-xl ${roleCfg.avatarBg} flex items-center justify-center shadow-sm shrink-0`}>
                                                <span className={`text-sm font-bold ${roleCfg.avatarText}`}>
                                                    {(m.displayName || m.email).substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-800 truncate text-sm">{m.displayName || m.email.split('@')[0]}</span>
                                                    {isCurrentUser && (
                                                        <span className="text-[9px] bg-aera-100 text-aera-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0">
                                                            Sie
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400 truncate block">{m.email}</span>
                                            </div>
                                        </div>

                                        {/* Role Badge */}
                                        <div className="w-32 flex justify-center">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${roleCfg.badgeBg} ${roleCfg.badgeText}`}>
                                                <RoleIcon className="w-3 h-3" />
                                                {roleCfg.label}
                                            </span>
                                        </div>

                                        {/* Status */}
                                        <div className="w-24 flex justify-center">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${statusCfg.bgColor} ${statusCfg.textColor}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                                                {statusCfg.label}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="w-12 flex justify-end">
                                            {isOrgAdmin && !isCurrentUser ? (
                                                <div className="relative">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setActiveMenu(menuOpen ? null : m.uid); }}
                                                        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    {menuOpen && (
                                                        <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150" onClick={e => e.stopPropagation()}>
                                                            <p className="px-4 py-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">Rolle ändern</p>
                                                            {ROLES.map(role => {
                                                                const isActive = m.role === role.id;
                                                                return (
                                                                    <button
                                                                        key={role.id}
                                                                        onClick={() => handleRoleChange(m, role.id)}
                                                                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isActive ? 'bg-aera-50 text-aera-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                    >
                                                                        <role.icon className={`w-4 h-4 ${isActive ? 'text-aera-600' : 'text-slate-400'}`} />
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className={`text-sm block ${isActive ? 'font-semibold' : ''}`}>{role.label}</span>
                                                                            <span className="text-[10px] text-slate-400 block">{role.description}</span>
                                                                        </div>
                                                                        {isActive && <Check className="w-4 h-4 text-aera-600 shrink-0" />}
                                                                    </button>
                                                                );
                                                            })}
                                                            <div className="border-t border-slate-100 my-1.5" />
                                                            <button
                                                                onClick={() => handleToggleStatus(m)}
                                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 ${m.status === 'deactivated' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-red-500 hover:bg-red-50'}`}
                                                            >
                                                                {m.status === 'deactivated' ? (
                                                                    <><UserCheck className="w-4 h-4" /> Reaktivieren</>
                                                                ) : (
                                                                    <><UserX className="w-4 h-4" /> Deaktivieren</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-8" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                                {filtered.length} von {members.length} Mitglied{members.length !== 1 ? 'ern' : ''}
                            </span>
                            {adminCount > 0 && (
                                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <Crown className="w-3 h-3 text-amber-400" />
                                    {adminCount} Admin{adminCount !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══ ROLE PERMISSIONS INFO ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-aera-600" />
                        Rollen & Berechtigungen
                    </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    {ROLES.map(role => (
                        <div key={role.id} className="p-5 group hover:bg-slate-50/50 transition-colors">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-sm mb-3`}>
                                <role.icon className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="font-semibold text-sm text-slate-800">{role.label}</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{role.description}</p>
                            <p className="text-[10px] text-slate-300 mt-2 font-medium">
                                {members.filter(m => m.role === role.id).length} Mitglied{members.filter(m => m.role === role.id).length !== 1 ? 'er' : ''}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ NON-ADMIN NOTICE ═══ */}
            {/* ═══ DANGER ZONE ═══ */}
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <TriangleAlert className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-red-700">Gefahrenzone</h3>
                        <p className="text-xs text-red-400">Diese Aktionen sind nicht umkehrbar</p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {/* Logout */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Abmelden</p>
                            <p className="text-xs text-slate-500 mt-0.5">Aktuelle Sitzung beenden</p>
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:text-slate-800 transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            Abmelden
                        </button>
                    </div>

                    {/* Delete Account */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-200">
                        <div>
                            <p className="text-sm font-semibold text-red-800">Konto löschen</p>
                            <p className="text-xs text-red-500 mt-0.5">Löscht Ihr Firebase-Konto dauerhaft. Organisationsdaten bleiben 30 Tage erhalten (DSGVO).</p>
                        </div>
                        <button
                            onClick={() => { setShowDeleteModal(true); setDeleteEmailInput(''); setDeleteError(null); }}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shrink-0 ml-4"
                        >
                            <Trash2 className="w-4 h-4" />
                            Konto löschen
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ DELETE ACCOUNT MODAL ═══ */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowDeleteModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="px-8 py-6 bg-gradient-to-r from-red-700 to-red-600 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Konto dauerhaft löschen</h3>
                                    <p className="text-red-200 text-xs mt-0.5">Diese Aktion kann nicht rückgängig gemacht werden</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="px-8 py-6 space-y-5">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <TriangleAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                    <div className="text-xs text-red-700 leading-relaxed">
                                        <p className="font-semibold mb-1">Was passiert bei der Löschung?</p>
                                        <ul className="list-disc ml-4 space-y-1">
                                            <li>Ihr Login-Konto wird sofort gelöscht</li>
                                            <li>Ihre Sitzung wird beendet</li>
                                            <li>Organisationsdaten (Immobilien, Mieter etc.) bleiben 30 Tage erhalten (DSGVO)</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Zur Bestätigung Ihre E-Mail-Adresse eingeben
                                </label>
                                <input
                                    type="email"
                                    value={deleteEmailInput}
                                    onChange={e => { setDeleteEmailInput(e.target.value); setDeleteError(null); }}
                                    placeholder={user?.email || 'ihre@email.de'}
                                    autoFocus
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all"
                                />
                                {deleteError && (
                                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 shrink-0" />{deleteError}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setShowDeleteModal(false)} className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors">
                                    Abbrechen
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!deleteEmailInput.trim()) {
                                            setDeleteError('Bitte geben Sie Ihre E-Mail-Adresse ein.');
                                            return;
                                        }
                                        setDeleting(true);
                                        setDeleteError(null);
                                        try {
                                            await deleteAccount(deleteEmailInput.trim());
                                            // Firebase Auth user is now deleted — sign out local session
                                            await logout();
                                        } catch (err: any) {
                                            setDeleteError(err.message || 'Fehler beim Löschen. Bitte erneut versuchen.');
                                        } finally {
                                            setDeleting(false);
                                        }
                                    }}
                                    disabled={deleting || !deleteEmailInput.trim()}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    {deleting ? 'Wird gelöscht…' : 'Endgültig löschen'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrgUsers;
