// ===== AERA SCALE — Organisation Context =====
// Resolves the current user's organisation membership after Firebase Auth login.
// Provides orgId, role, member status to the entire app.

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collectionGroup, collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './AuthContext';
import type { Organization, OrgMember, OrgRole } from '../types';

// ── Context Type ──

type OrgState =
    | { status: 'loading' }
    | { status: 'resolved'; orgId: string; org: Organization; member: OrgMember }
    | { status: 'error'; code: 'NO_ORG' | 'DEACTIVATED' | 'PENDING' | 'ORG_NOT_FOUND' | 'UNKNOWN' };

interface OrgContextType {
    orgId: string;
    org: Organization;
    member: OrgMember;
    role: OrgRole;
    isOrgAdmin: boolean;
    state: OrgState;
    refreshOrg: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | null>(null);

export const useOrg = (): OrgContextType => {
    const ctx = useContext(OrgContext);
    if (!ctx) throw new Error('useOrg must be used within OrgProvider');
    return ctx;
};

// ── Helper: Find user's org membership ──
// Strategy 1: Collection group query on 'members' (preferred, fast)
// Strategy 2: Iterate organizations (fallback if collection group index not ready)

async function findUserMembership(uid: string): Promise<{ orgId: string; member: OrgMember } | null> {
    if (!db) return null;

    // Strategy 1: Collection group query
    try {
        const membersQuery = query(
            collectionGroup(db, 'members'),
            where('uid', '==', uid)
        );
        const snap = await getDocs(membersQuery);

        if (!snap.empty) {
            const memberDoc = snap.docs[0];
            const memberData = memberDoc.data() as OrgMember;
            // Extract orgId from path: orgMembers/{orgId}/members/{uid}
            const pathSegments = memberDoc.ref.path.split('/');
            const orgId = pathSegments[1];
            console.log(`✅ Found membership via collection group query: org=${orgId}`);
            return { orgId, member: memberData };
        }
    } catch (e) {
        console.warn('⚠️ Collection group query failed (index may not be ready), trying fallback:', e);
    }

    // Strategy 2: Iterate organizations (fallback)
    try {
        const orgsSnap = await getDocs(collection(db, 'organizations'));
        for (const orgDoc of orgsSnap.docs) {
            try {
                const memberDoc = await getDoc(doc(db, 'orgMembers', orgDoc.id, 'members', uid));
                if (memberDoc.exists()) {
                    console.log(`✅ Found membership via fallback: org=${orgDoc.id}`);
                    return {
                        orgId: orgDoc.id,
                        member: memberDoc.data() as OrgMember,
                    };
                }
            } catch (innerErr) {
                // Permission denied on this org's members — skip
                continue;
            }
        }
    } catch (e) {
        console.warn('⚠️ Fallback org iteration also failed:', e);
    }

    return null;
}

async function getOrganization(orgId: string): Promise<Organization | null> {
    if (!db) return null;
    try {
        const docSnap = await getDoc(doc(db, 'organizations', orgId));
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Organization;
        }
        return null;
    } catch (e) {
        console.error('Error fetching organization:', e);
        return null;
    }
}

// ── Auto-create org for users with no membership ──
async function autoCreateOrg(uid: string, email: string, displayName: string): Promise<{ orgId: string; org: Organization; member: OrgMember }> {
    // IMPORTANT: Use deterministic orgId based only on uid (no timestamp!)
    // so repeated calls don't create duplicate orgs
    const newOrgId = `org_${uid}`;

    // Check if this org already exists (might've been created before but membership query failed)
    const existingOrg = await getDoc(doc(db!, 'organizations', newOrgId));
    if (existingOrg.exists()) {
        console.log(`🏢 Org ${newOrgId} already exists — reusing`);
        const orgData = { id: existingOrg.id, ...existingOrg.data() } as Organization;
        // Ensure membership exists
        const existingMember = await getDoc(doc(db!, 'orgMembers', newOrgId, 'members', uid));
        if (existingMember.exists()) {
            return { orgId: newOrgId, org: orgData, member: existingMember.data() as OrgMember };
        }
        // Org exists but membership doesn't — create membership
        const memberData: OrgMember = {
            uid, email, displayName,
            role: 'org_admin', status: 'active',
            invitedAt: new Date().toISOString(), invitedBy: uid,
            activatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db!, 'orgMembers', newOrgId, 'members', uid), memberData);
        console.log(`🏢 Re-created membership for existing org ${newOrgId}`);
        return { orgId: newOrgId, org: orgData, member: memberData };
    }

    const orgName = `Organisation ${displayName}`;
    const orgData: Organization = {
        id: newOrgId,
        name: orgName,
        createdAt: new Date().toISOString(),
        createdBy: uid,
        onboardingComplete: true,
    };

    const memberData: OrgMember = {
        uid, email, displayName,
        role: 'org_admin', status: 'active',
        invitedAt: new Date().toISOString(), invitedBy: uid,
        activatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db!, 'organizations', newOrgId), orgData);
    await setDoc(doc(db!, 'orgMembers', newOrgId, 'members', uid), memberData);
    console.log(`🏢 Auto-created org ${newOrgId} for user ${uid}`);

    return { orgId: newOrgId, org: orgData, member: memberData };
}

// ── Provider ──

const EMPTY_ORG: Organization = { id: '', name: '', createdAt: '', createdBy: '', onboardingComplete: true };
const EMPTY_MEMBER: OrgMember = { uid: '', email: '', displayName: '', role: 'user', status: 'active', invitedAt: '', invitedBy: '' };

export const OrgProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [state, setState] = useState<OrgState>({ status: 'loading' });

    const resolve = useCallback(async () => {
        if (!user || !db) {
            setState({ status: 'error', code: 'NO_ORG' });
            return;
        }

        setState({ status: 'loading' });

        try {
            let membership = await findUserMembership(user.uid);

            // No membership found — auto-create for verified users
            if (!membership && user.emailVerified) {
                console.log('🔄 No membership found — auto-creating org for verified user...');
                const displayName = user.displayName || user.email?.split('@')[0] || 'User';
                const created = await autoCreateOrg(user.uid, user.email || '', displayName);
                setState({ status: 'resolved', orgId: created.orgId, org: created.org, member: created.member });
                return;
            }

            if (!membership) {
                setState({ status: 'error', code: 'NO_ORG' });
                return;
            }

            // Check member status
            if (membership.member.status === 'deactivated') {
                setState({ status: 'error', code: 'DEACTIVATED' });
                return;
            }

            if (membership.member.status === 'pending') {
                if (user.emailVerified) {
                    const memberRef = doc(db, 'orgMembers', membership.orgId, 'members', user.uid);
                    await setDoc(memberRef, {
                        ...membership.member,
                        status: 'active',
                        activatedAt: new Date().toISOString(),
                    }, { merge: true });
                    membership.member.status = 'active';
                } else {
                    setState({ status: 'error', code: 'PENDING' });
                    return;
                }
            }

            const orgData = await getOrganization(membership.orgId);
            if (!orgData) {
                setState({ status: 'error', code: 'ORG_NOT_FOUND' });
                return;
            }

            setState({ status: 'resolved', orgId: membership.orgId, org: orgData, member: membership.member });
        } catch (e) {
            console.error('OrgContext resolution error:', e);
            setState({ status: 'error', code: 'UNKNOWN' });
        }
    }, [user]);

    useEffect(() => {
        resolve();
    }, [resolve]);

    // ── Derive context value ──
    const resolved = state.status === 'resolved' ? state : null;

    const value: OrgContextType = {
        orgId: resolved?.orgId || '',
        org: resolved?.org || EMPTY_ORG,
        member: resolved?.member || EMPTY_MEMBER,
        role: resolved?.member?.role || 'user',
        isOrgAdmin: resolved?.member?.role === 'org_admin',
        state,
        refreshOrg: resolve,
    };

    // ── Render gates ──

    if (state.status === 'loading') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-aera-950">
                <div className="w-10 h-10 border-4 border-aera-600/30 border-t-aera-400 rounded-full animate-spin mb-4" />
                <p className="text-aera-200/50 text-sm font-medium">Organisation wird geladen…</p>
            </div>
        );
    }

    if (state.status === 'error' && state.code === 'DEACTIVATED') {
        return (
            <div className="h-screen flex items-center justify-center bg-aera-950">
                <div className="bg-white/5 backdrop-blur-sm border border-red-500/30 rounded-2xl p-10 max-w-md text-center">
                    <h2 className="text-xl font-bold text-white mb-2">Account deaktiviert</h2>
                    <p className="text-slate-400 text-sm">Ihr Account wurde von einem Administrator deaktiviert.</p>
                </div>
            </div>
        );
    }

    if (state.status === 'error' && state.code === 'PENDING') {
        return (
            <div className="h-screen flex items-center justify-center bg-aera-950">
                <div className="bg-white/5 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-10 max-w-md text-center">
                    <h2 className="text-xl font-bold text-white mb-2">Einladung ausstehend</h2>
                    <p className="text-slate-400 text-sm">Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.</p>
                </div>
            </div>
        );
    }

    // For any other error (NO_ORG, ORG_NOT_FOUND, UNKNOWN), still provide context
    // so OrgGate can handle it
    return (
        <OrgContext.Provider value={value}>
            {children}
        </OrgContext.Provider>
    );
};
