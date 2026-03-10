import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Play, AlertTriangle, Cloud, Database, Map } from 'lucide-react';
import { getModel } from '../services/geminiService';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

declare global {
    interface Window {
        google: any;
    }
}

interface ServiceStatus {
    name: string;
    status: 'idle' | 'running' | 'success' | 'error';
    message?: string;
    icon: React.ElementType;
}

const HealthCheck: React.FC = () => {
    const [services, setServices] = useState<ServiceStatus[]>([
        { name: 'Google Maps API', status: 'idle', icon: Map },
        { name: 'Vertex AI (Gemini)', status: 'idle', icon: Cloud },
        { name: 'Firestore Database', status: 'idle', icon: Database },
    ]);

    const updateStatus = (index: number, status: 'idle' | 'running' | 'success' | 'error', message?: string) => {
        setServices(prev => {
            const next = [...prev];
            next[index] = { ...next[index], status, message };
            return next;
        });
    };

    const runTests = async () => {
        // Reset
        setServices(prev => prev.map(s => ({ ...s, status: 'running', message: undefined })));

        // 1. Check Maps
        try {
            // Check if google maps script is loaded or globally available
            if (typeof window.google !== 'undefined' && window.google.maps) {
                updateStatus(0, 'success', 'Maps API loaded and ready');
            } else {
                throw new Error("Maps API Key missing or Maps JavaScript API not enabled in Google Cloud.");
            }
        } catch (error: any) {
            updateStatus(0, 'error', error.message || 'Maps API check failed');
        }

        // 2. Check Gemini
        try {
            const model = getModel();
            if (!model) throw new Error("Model initialization failed");

            const result = await model.generateContent("Hello. Reply with 'OK'.");
            const response = await result.response;
            const text = response.text();

            if (text) {
                updateStatus(1, 'success', `Response received: "${text.slice(0, 20)}..."`);
            } else {
                throw new Error("Empty response from Gemini");
            }
        } catch (error: any) {
            updateStatus(1, 'error', "Gemini API Key invalid or Model not found.");
        }

        // 3. Check Firestore
        try {
            if (!db) throw new Error("Firestore not initialized");

            const colRef = collection(db, "_healthcheck");
            const docRef = await addDoc(colRef, {
                test: "Connectivity Check",
                timestamp: serverTimestamp()
            });

            // Immediately delete
            await deleteDoc(docRef);
            updateStatus(2, 'success', 'Write and Delete operations successful');
        } catch (error: any) {
            updateStatus(2, 'error', "Firestore Rules blocked access or Database not created.");
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-10">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">System Health Check</h1>
                        <p className="text-sm text-slate-500">Diagnostic tool for external service connectivity.</p>
                    </div>
                    <button
                        onClick={runTests}
                        className="bg-aera-600 hover:bg-aera-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Run All Tests
                    </button>
                </div>

                <div className="divide-y divide-slate-100">
                    {services.map((service, idx) => (
                        <div key={service.name} className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                            <div className={`p-3 rounded-lg ${service.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                service.status === 'error' ? 'bg-red-100 text-red-600' :
                                    service.status === 'running' ? 'bg-slate-100 text-aera-600' :
                                        'bg-slate-100 text-slate-400'
                                }`}>
                                {service.status === 'running' ? <Loader2 className="w-6 h-6 animate-spin" /> :
                                    service.status === 'success' ? <CheckCircle2 className="w-6 h-6" /> :
                                        service.status === 'error' ? <XCircle className="w-6 h-6" /> :
                                            <service.icon className="w-6 h-6" />}
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-900">{service.name}</h3>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide ${service.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                                        service.status === 'error' ? 'bg-red-50 text-red-700' :
                                            service.status === 'running' ? 'bg-blue-50 text-blue-700' :
                                                'bg-slate-100 text-slate-500'
                                        }`}>
                                        {service.status === 'idle' ? 'Pending' : service.status}
                                    </span>
                                </div>
                                <p className={`mt-1 text-sm ${service.status === 'error' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                                    {service.message || 'Waiting to run test...'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-slate-50 p-4 text-xs text-slate-400 border-t border-slate-100 text-center">
                    Note: Ensure all services are enabled in your Google Cloud Console. Run setup_apis.ps1 if connectivity fails.
                </div>
            </div>
        </div>
    );
};

export default HealthCheck;
