import React, { useEffect, useState } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, getDocs, limit, query } from 'firebase/firestore';

const DebugInfo: React.FC = () => {
    const [checks, setChecks] = useState<any>({
        envVar: 'Loading...',
        mapsObject: 'Loading...',
        firebase: 'Loading...'
    });
    const [aiStatus, setAiStatus] = useState<string>('Ready to Test');
    const [aiError, setAiError] = useState<string | null>(null);
    const [testingAI, setTestingAI] = useState(false);

    useEffect(() => {
        const runChecks = async () => {
            // ... existing checks ...
            const newChecks: any = {};

            // 1. Env Var Check
            // @ts-ignore
            const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!mapsKey) {
                newChecks.envVar = "❌ MISSING (Undefined)";
            } else if (mapsKey.length < 10) {
                newChecks.envVar = "❌ INVALID (Too short)";
            } else {
                newChecks.envVar = `✅ Present (${mapsKey.substring(0, 5)}...)`;
            }

            // 2. Maps Object Check
            if (window.google && window.google.maps) {
                newChecks.mapsObject = "✅ window.google.maps exists";
            } else {
                newChecks.mapsObject = "❌ window.google.maps is UNDEFINED";
            }

            // 3. Firebase Connection Check
            try {
                if (!db) {
                    newChecks.firebase = "❌ Database Not Initialized (Check Config)";
                } else {
                    const q = query(collection(db, 'properties'), limit(1));
                    await getDocs(q);
                    newChecks.firebase = "✅ Read Success (Connected)";
                }
            } catch (e: any) {
                newChecks.firebase = `❌ Connection Failed: ${e.message}`;
            }

            setChecks(newChecks);
        };

        runChecks();
        const interval = setInterval(runChecks, 2000);
        return () => clearInterval(interval);
    }, []);

    const testAI = async () => {
        setTestingAI(true);
        setAiStatus('Testing...');
        setAiError(null);
        try {
            const { getGenerativeModel } = await import('firebase/ai');
            const { ai } = await import('../services/firebaseConfig');

            if (!ai) throw new Error("Firebase Vertex AI instance is null (Initialization failed)");

            const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });
            const result = await model.generateContent("Hello, reply with 'OK'.");
            const response = await result.response;
            const text = response.text();

            if (text.includes('OK') || text.length > 0) {
                setAiStatus("✅ Connected (Generated Response)");
            } else {
                setAiStatus("⚠️ Connected but empty response");
            }
        } catch (e: any) {
            console.error("AI Test Error:", e);
            setAiStatus("❌ Failed");
            setAiError(e.message || JSON.stringify(e));
        } finally {
            setTestingAI(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto bg-white shadow-lg rounded-xl mt-10">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">System Diagnostic Dashboard</h1>

            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-sm text-slate-500 uppercase">1. Environment Variables</h3>
                    <p className={`text-lg font-mono mt-1 ${checks.envVar.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                        VITE_GOOGLE_MAPS_API_KEY: {checks.envVar}
                    </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-sm text-slate-500 uppercase">2. Google Maps API</h3>
                    <p className={`text-lg font-mono mt-1 ${checks.mapsObject.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                        Global Object: {checks.mapsObject}
                    </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-sm text-slate-500 uppercase">3. Firebase Database</h3>
                    <p className={`text-lg font-mono mt-1 ${checks.firebase.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                        Connection: {checks.firebase}
                    </p>
                    {/* @ts-ignore */}
                    <p className="text-xs text-slate-400 mt-2">Project ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-sm text-slate-500 uppercase">4. Vertex AI Connection</h3>
                    <p className={`text-lg font-mono mt-1 ${aiStatus.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                        Status: {aiStatus}
                    </p>
                    <button
                        onClick={testAI}
                        disabled={testingAI}
                        className="mt-3 px-3 py-1 bg-aera-600 text-white text-sm rounded hover:bg-aera-700 disabled:opacity-50"
                    >
                        {testingAI ? 'Testing...' : 'Test Generation'}
                    </button>
                    {aiError && (
                        <div className="mt-2 p-2 bg-red-100 text-red-700 text-xs rounded font-mono break-all">
                            {aiError}
                        </div>
                    )}
                </div>
            </div>

            <button onClick={() => window.location.reload()} className="mt-8 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">
                Reload Page
            </button>
        </div>
    );
};

export default DebugInfo;
