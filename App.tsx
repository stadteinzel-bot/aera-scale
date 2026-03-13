
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadGoogleMaps } from './utils/mapsLoader';
import { useAuth } from './services/AuthContext';
import { OrgProvider, useOrg } from './services/OrgContext';
import LoginPage from './components/LoginPage';
import VerifyEmail from './components/VerifyEmail';
import OnboardingWizard from './components/OnboardingWizard';
import SessionTimeoutModal from './components/SessionTimeoutModal';
import Sidebar from './components/Sidebar';
import AssetLayout from './components/AssetLayout';
import { AppView, AssetTab } from './types';
import { DataCoreProvider, useDataCore } from './core/DataCoreProvider';
import { I18nProvider } from './core/i18nProvider';
import { dataService } from './services/dataService';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// ── Route-Level Code-Splitting ──
// Heavy view components are loaded on-demand to reduce initial bundle size
const Dashboard = lazy(() => import('./components/Dashboard'));
const Properties = lazy(() => import('./components/Properties'));
const Tenants = lazy(() => import('./components/Tenants'));
const Finance = lazy(() => import('./components/Finance'));
const Settings = lazy(() => import('./components/Settings'));
const TenantPortal = lazy(() => import('./components/TenantPortal'));
const HealthCheck = lazy(() => import('./components/HealthCheck'));
const DebugInfo = lazy(() => import('./components/DebugInfo'));

// Loading fallback for lazy-loaded views
const ViewLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-3 border-aera-600/30 border-t-aera-400 rounded-full animate-spin" />
  </div>
);

// ── OrgGate: handles onboarding and data scoping ──
const OrgGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { orgId, org, state, refreshOrg } = useOrg();
  const [onboardingOverride, setOnboardingOverride] = useState(false);

  useEffect(() => {
    if (orgId) {
      // Scope all data queries to this org
      dataService.init(orgId);
    }
  }, [orgId]);

  // Still resolving org membership
  if (state.status === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-aera-950">
        <div className="w-10 h-10 border-4 border-aera-600/30 border-t-aera-400 rounded-full animate-spin mb-4" />
        <p className="text-aera-200/50 text-sm font-medium">Organisation wird geladen…</p>
      </div>
    );
  }

  // Error states
  if (state.status === 'error') {
    return (
      <div className="h-screen flex items-center justify-center bg-aera-950">
        <div className="bg-white/5 backdrop-blur-sm border border-aera-700/50 rounded-2xl p-10 max-w-md text-center">
          <h2 className="text-xl font-bold text-white mb-2">Anmeldung fehlgeschlagen</h2>
          <p className="text-slate-400 text-sm mb-4">
            Fehlercode: {state.code}. Bitte versuchen Sie es erneut.
          </p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-aera-600 text-white rounded-xl text-sm font-medium hover:bg-aera-500 transition-colors">
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  // Resolved — check onboarding
  if (!org.onboardingComplete && !onboardingOverride) {
    return <OnboardingWizard onComplete={() => setOnboardingOverride(true)} />;
  }

  return <DataCoreProvider orgId={orgId}>{children}</DataCoreProvider>;
};



// Inner app that has access to DataCore
const AppInner: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<AssetTab>(AssetTab.OVERVIEW);
  const { data, isLoading } = useDataCore();
  const { logout } = useAuth();
  const hasAutoSelected = React.useRef(false);

  // Session timeout: auto-logout after 30 min inactivity
  const { showWarning, remainingSeconds, extendSession } = useSessionTimeout(logout);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#health') setCurrentView(AppView.HEALTH);
      if (window.location.hash === '#debug-test') setCurrentView(AppView.DEBUG);
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Auto-select first property once data loads — land users directly in the asset view
  useEffect(() => {
    if (!isLoading && !hasAutoSelected.current && data.properties.length > 0) {
      hasAutoSelected.current = true;
      setSelectedAssetId(data.properties[0].id);
      setActiveAssetTab(AssetTab.OVERVIEW);
    }
  }, [isLoading, data.properties]);

  // When a property is selected from Properties list or Dashboard
  const handleSelectAsset = (propertyId: string) => {
    setSelectedAssetId(propertyId);
    setActiveAssetTab(AssetTab.OVERVIEW);
  };

  // Exit asset context → return to properties
  const handleBackToProperties = () => {
    setSelectedAssetId(null);
    setCurrentView(AppView.PROPERTIES);
  };

  // Global view change (clears asset context)
  const handleChangeView = (view: AppView) => {
    setSelectedAssetId(null);
    setCurrentView(view);
  };

  // Switch between assets (stays in asset context)
  const handleSwitchAsset = (propertyId: string) => {
    setSelectedAssetId(propertyId);
    setActiveAssetTab(AssetTab.OVERVIEW);
  };

  const selectedProperty = selectedAssetId
    ? data.properties.find(p => p.id === selectedAssetId) || null
    : null;

  // Tenant Portal mode: hide sidebar
  if (currentView === AppView.TENANT_PORTAL) {
    return (
      <div className="h-screen bg-slate-50 font-sans text-slate-900 relative overflow-hidden">
        <button
          onClick={() => handleChangeView(AppView.DASHBOARD)}
          className="fixed bottom-4 left-4 z-50 bg-slate-800 text-white px-3 py-1 rounded-full text-xs opacity-50 hover:opacity-100 transition-opacity shadow-lg"
        >
          Exit Portal
        </button>
        <div className="h-full overflow-y-auto">
          <TenantPortal />
        </div>
      </div>
    );
  }

  const renderGlobalView = () => {
    const view = (() => {
      switch (currentView) {
        case AppView.DASHBOARD:
          return <Dashboard onSelectAsset={handleSelectAsset} />;
        case AppView.PROPERTIES:
          return <Properties onSelectAsset={handleSelectAsset} />;
        case AppView.TENANTS:
          return <Tenants />;
        case AppView.FINANCE:
          return <Finance />;
        case AppView.SETTINGS:
          return <Settings />;
        case AppView.HEALTH:
          return <HealthCheck />;
        case AppView.DEBUG:
          return <DebugInfo />;
        default:
          return <Dashboard onSelectAsset={handleSelectAsset} />;
      }
    })();
    return <Suspense fallback={<ViewLoader />}>{view}</Suspense>;
  };

  return (
    <div className="flex h-screen bg-cream-100 font-sans text-slate-900 overflow-hidden">
      {/* Session Timeout Warning */}
      {showWarning && (
        <SessionTimeoutModal
          remainingSeconds={remainingSeconds}
          onExtend={extendSession}
          onLogout={logout}
        />
      )}
      <Sidebar
        currentView={currentView}
        onChangeView={handleChangeView}
        hasActiveAsset={!!selectedAssetId}
      />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {selectedAssetId && selectedProperty ? (
          // ── Asset Context ──
          <AssetLayout
            property={selectedProperty}
            activeTab={activeAssetTab}
            onTabChange={setActiveAssetTab}
            onBack={handleBackToProperties}
            onSwitchAsset={handleSwitchAsset}
          />
        ) : (
          // ── Global Views ──
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-8 w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="h-full"
                >
                  {renderGlobalView()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    loadGoogleMaps().catch(err => console.error("Maps Load Error:", err));
  }, []);

  // Auth Loading State
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-aera-950">
        <div className="w-10 h-10 border-4 border-aera-600/30 border-t-aera-400 rounded-full animate-spin mb-4" />
        <p className="text-aera-200/50 text-sm font-medium">Loading AERA SCALE...</p>
      </div>
    );
  }

  // Not authenticated → Login
  if (!user) {
    return <LoginPage />;
  }

  // Authenticated but email NOT verified → Verify Email Page
  if (!user.emailVerified) {
    return <VerifyEmail />;
  }

  return (
    <I18nProvider>
      <OrgProvider>
        <OrgGate>
          <AppInner />
        </OrgGate>
      </OrgProvider>
      {/* PWA prompts — global overlays */}
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
    </I18nProvider>
  );
};

export default App;

