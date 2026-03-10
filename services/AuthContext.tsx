import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    User
} from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import type { Organization, OrgMember } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, orgName?: string) => Promise<void>;
    logout: () => Promise<void>;
    resendVerificationEmail: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            console.warn('⚠️ Firebase Auth not available — running without auth');
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        if (!auth) throw new Error('Firebase Auth is not initialized');
        await signInWithEmailAndPassword(auth, email, password);
    };

    const register = async (email: string, password: string, orgName?: string) => {
        if (!auth || !db) throw new Error('Firebase Auth/Firestore is not initialized');

        // 1. Create Firebase Auth user
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // 2. Check if user was pre-invited to an existing org
        //    Uses collectionGroup query (O(1)) instead of iterating all orgs (O(N*M))
        let wasInvited = false;
        try {
            const { collectionGroup, query, where } = await import('firebase/firestore');
            const inviteQuery = query(
                collectionGroup(db, 'members'),
                where('email', '==', email),
                where('status', '==', 'pending')
            );
            const inviteSnap = await getDocs(inviteQuery);

            if (!inviteSnap.empty) {
                const memberDoc = inviteSnap.docs[0];
                const memberData = memberDoc.data();
                // Extract orgId from path: orgMembers/{orgId}/members/{placeholderId}
                const pathSegments = memberDoc.ref.path.split('/');
                const orgId = pathSegments[1];

                // Re-key the member doc with the real UID
                const memberPayload: OrgMember = {
                    uid,
                    email,
                    displayName: memberData.displayName || email.split('@')[0],
                    role: memberData.role || 'user',
                    status: 'pending', // Will be activated when email is verified
                    invitedAt: memberData.invitedAt,
                    invitedBy: memberData.invitedBy,
                };
                await setDoc(doc(db, 'orgMembers', orgId, 'members', uid), memberPayload);
                if (memberDoc.id !== uid) {
                    // Clean up placeholder doc
                    const { deleteDoc: delDoc } = await import('firebase/firestore');
                    await delDoc(doc(db, 'orgMembers', orgId, 'members', memberDoc.id));
                }
                wasInvited = true;
            }
        } catch (e) {
            console.warn('Could not check for pre-invitations:', e);
        }

        // 3. If not invited, create a new organisation
        if (!wasInvited) {
            const orgId = `org_${uid}_${Date.now()}`;
            const resolvedOrgName = orgName || `Organisation ${email.split('@')[0]}`;

            const orgData: Organization = {
                id: orgId,
                name: resolvedOrgName,
                createdAt: new Date().toISOString(),
                createdBy: uid,
                onboardingComplete: false,
            };

            const memberData: OrgMember = {
                uid,
                email,
                displayName: email.split('@')[0],
                role: 'org_admin',
                status: 'active',
                invitedAt: new Date().toISOString(),
                invitedBy: uid,
                activatedAt: new Date().toISOString(),
            };

            await setDoc(doc(db, 'organizations', orgId), orgData);
            await setDoc(doc(db, 'orgMembers', orgId, 'members', uid), memberData);
            console.log(`🏢 Created new org: ${orgId} for user ${uid}`);
        }

        // 4. Send verification email
        await sendEmailVerification(credential.user);
    };

    const resendVerificationEmail = async () => {
        if (!auth?.currentUser) throw new Error('No user logged in');
        if (auth.currentUser.emailVerified) throw new Error('Email already verified');
        await sendEmailVerification(auth.currentUser);
    };

    const refreshUser = async () => {
        if (!auth?.currentUser) return;
        // Reload user data from Firebase to get fresh emailVerified status
        await auth.currentUser.reload();
        // Trigger re-render with updated user object
        setUser({ ...auth.currentUser } as User);
    };

    const logout = async () => {
        if (!auth) return;
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, resendVerificationEmail, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
