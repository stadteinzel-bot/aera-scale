/**
 * useRealtimeCollection — React hook for Firestore onSnapshot realtime listeners.
 * Provides automatic subscription/cleanup and optimistic error handling.
 */
import { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit, type QueryConstraint } from 'firebase/firestore';

interface RealtimeConfig {
    collectionName: string;
    orgId: string;
    /** Additional query constraints (e.g., where, orderBy) */
    constraints?: QueryConstraint[];
    /** Max documents to listen to (default: 200) */
    maxDocs?: number;
    /** Whether the listener is enabled (default: true) */
    enabled?: boolean;
}

interface RealtimeResult<T> {
    data: T[];
    loading: boolean;
    error: string | null;
    /** Number of listener updates received */
    updateCount: number;
}

/**
 * Subscribes to a Firestore collection using onSnapshot for realtime updates.
 * Automatically cleans up the listener on unmount.
 *
 * Usage:
 * ```tsx
 * const { data: tickets, loading } = useRealtimeCollection<Ticket>({
 *   collectionName: 'tickets',
 *   orgId: currentOrgId,
 *   constraints: [where('status', '==', 'open')],
 * });
 * ```
 */
export function useRealtimeCollection<T extends { id: string }>(config: RealtimeConfig): RealtimeResult<T> {
    const { collectionName, orgId, constraints = [], maxDocs = 200, enabled = true } = config;
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const updateCountRef = useRef(0);
    const [updateCount, setUpdateCount] = useState(0);

    useEffect(() => {
        if (!db || !orgId || !enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const q = query(
            collection(db, collectionName),
            where('orgId', '==', orgId),
            ...constraints,
            limit(maxDocs)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...(doc.data() as any),
                })) as T[];
                setData(items);
                setLoading(false);
                updateCountRef.current += 1;
                setUpdateCount(updateCountRef.current);
            },
            (err) => {
                console.error(`[Realtime] Error on ${collectionName}:`, err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionName, orgId, enabled, maxDocs]);

    return { data, loading, error, updateCount };
}

export default useRealtimeCollection;
