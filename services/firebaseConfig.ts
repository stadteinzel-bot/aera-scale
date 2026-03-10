import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAI, VertexAIBackend, AI } from "firebase/ai";

// Helper: Read env var from Vite build-time OR runtime window._env_ (injected by env.sh in Docker)
const getEnv = (key: string): string => {
    // 1. Try Vite build-time injection
    const buildTime = (import.meta.env as any)?.[key];
    if (buildTime) return buildTime;
    // 2. Try runtime injection (Docker/Cloud Run)
    const runtimeEnv = (window as any)?._env_;
    if (runtimeEnv && runtimeEnv[key]) return runtimeEnv[key];
    return '';
};

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID')
};

let app;
let db;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;
let ai: AI | undefined;

try {
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        console.log("🔥 Attempting to initialize Firebase...");
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app, 'gs://aera-scale-documents');
        console.log("✅ Firestore, Auth & Storage initialized");

        // Initialize Vertex AI for Firebase
        try {
            console.log("🤖 Attempting to initialize Vertex AI...");
            ai = getAI(app, { backend: new VertexAIBackend() });
            console.log("✅ Vertex AI Initialized Successfully");
        } catch (aiError) {
            console.error("❌ Vertex AI Init Failed:", aiError);
            // Non-fatal, app can run without AI
        }
    } else {
        console.warn("⚠️ Firebase Config Missing (Check .env) - Running in Demo Mode");
    }
} catch (error) {
    console.error("❌ CRTICAL: Firebase Initialization Error:", error);
}

export { app, db, auth, storage, ai };
