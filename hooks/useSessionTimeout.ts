/**
 * ===== AERA SCALE — Session Timeout Hook =====
 * 
 * Auto-logout after 30 minutes of inactivity.
 * Tracks mouse, keyboard, scroll, and touch events as activity.
 * Shows a warning modal 2 minutes before timeout.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000;        // 30 minutes
const WARNING_MS = 2 * 60 * 1000;          // Show warning 2 min before logout
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

interface SessionTimeoutReturn {
    /** True when the warning modal should show */
    showWarning: boolean;
    /** Remaining seconds until auto-logout */
    remainingSeconds: number;
    /** Call to dismiss warning and reset timer */
    extendSession: () => void;
    /** Minutes of inactivity timeout (for display) */
    timeoutMinutes: number;
}

export function useSessionTimeout(onLogout: () => void): SessionTimeoutReturn {
    const [showWarning, setShowWarning] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const lastActivityRef = useRef<number>(Date.now());
    const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimers = useCallback(() => {
        lastActivityRef.current = Date.now();
        setShowWarning(false);
        setRemainingSeconds(0);

        // Clear existing timers
        if (warningTimerRef.current) clearInterval(warningTimerRef.current);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

        // Set warning timer
        logoutTimerRef.current = setTimeout(() => {
            setShowWarning(true);

            // Count down from WARNING_MS
            const countdownEnd = Date.now() + WARNING_MS;
            warningTimerRef.current = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000));
                setRemainingSeconds(remaining);

                if (remaining <= 0) {
                    if (warningTimerRef.current) clearInterval(warningTimerRef.current);
                    onLogout();
                }
            }, 1000);
        }, TIMEOUT_MS - WARNING_MS);
    }, [onLogout]);

    const handleActivity = useCallback(() => {
        // Only reset if not already in warning state
        if (!showWarning) {
            const now = Date.now();
            // Throttle: only reset if >5s since last activity
            if (now - lastActivityRef.current > 5000) {
                resetTimers();
            }
        }
    }, [showWarning, resetTimers]);

    const extendSession = useCallback(() => {
        resetTimers();
    }, [resetTimers]);

    useEffect(() => {
        // Initial setup
        resetTimers();

        // Listen for user activity
        ACTIVITY_EVENTS.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            ACTIVITY_EVENTS.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
            if (warningTimerRef.current) clearInterval(warningTimerRef.current);
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        };
    }, [handleActivity, resetTimers]);

    return {
        showWarning,
        remainingSeconds,
        extendSession,
        timeoutMinutes: TIMEOUT_MS / 60000,
    };
}

export default useSessionTimeout;
