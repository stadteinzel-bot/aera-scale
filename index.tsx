import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './services/AuthContext';
import { checkEnvOnBoot } from './utils/envValidation';
import './services/healthMonitor'; // Install global error handlers
import './index.css';

// ── Boot-time checks ──
checkEnvOnBoot();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);