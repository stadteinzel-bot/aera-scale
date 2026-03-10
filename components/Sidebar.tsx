
import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Building2, Users, Settings, LogOut, UserCircle, Hexagon, Wallet } from 'lucide-react';
import { AppView } from '../types';
import { useAuth } from '../services/AuthContext';
import { useOrg } from '../services/OrgContext';
import { useTranslation } from '../core/i18nProvider';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  hasActiveAsset?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, hasActiveAsset }) => {
  const { user, logout } = useAuth();
  const { role, org } = useOrg();
  const { t } = useTranslation();
  const userEmail = user?.email || 'User';
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  const ROLE_LABELS: Record<string, string> = {
    org_admin: 'Admin',
    user: 'Benutzer',
    finance: 'Finanzen',
    property_manager: 'Objektverwalter',
  };

  const navItems = [
    { id: AppView.DASHBOARD, label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { id: AppView.PROPERTIES, label: t('sidebar.properties'), icon: Building2 },
    { id: AppView.TENANTS, label: t('sidebar.tenants'), icon: Users },
    { id: AppView.FINANCE, label: 'Finanzen', icon: Wallet },
  ];

  return (
    <div className={`${hasActiveAsset ? 'w-20' : 'w-64'} bg-aera-900 text-stone-300 flex flex-col h-full border-r border-aera-800 shrink-0 transition-all duration-300`}>
      <div className={`${hasActiveAsset ? 'p-3 flex justify-center' : 'p-6'}`}>
        <div className={`flex items-center ${hasActiveAsset ? 'justify-center' : 'space-x-3 mb-1'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-aera-800 to-aera-950 border border-aera-600 rounded-lg flex items-center justify-center shadow-inner relative group overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-aera-600/10 group-hover:bg-aera-600/20 transition-colors"></div>
            <Hexagon className="w-6 h-6 text-aera-600 fill-current" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-aera-500 rounded-full border-2 border-aera-900"></div>
          </div>
          {!hasActiveAsset && (
            <div>
              <h1 className="text-2xl font-bold text-white tracking-widest leading-none font-serif">AERA</h1>
            </div>
          )}
        </div>
        {!hasActiveAsset && (
          <div className="text-[10px] text-aera-500 tracking-[0.3em] font-medium uppercase ml-1 flex items-center">
            SCALE <span className="w-8 h-px bg-aera-600/50 ml-2"></span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = currentView === item.id && !hasActiveAsset;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              title={hasActiveAsset ? item.label : undefined}
              className={`w-full flex items-center ${hasActiveAsset ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg transition-colors duration-200 group relative ${isActive
                ? 'text-aera-500 font-medium'
                : 'hover:text-white text-stone-500'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-aera-600/10 border border-aera-600/20 rounded-lg shadow-[0_0_15px_rgba(196,164,106,0.1)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-aera-600 rounded-r-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={`w-5 h-5 z-10 relative shrink-0 ${isActive ? 'text-aera-500' : 'text-stone-500 group-hover:text-white'}`} />
              {!hasActiveAsset && <span className="z-10 relative">{item.label}</span>}
            </button>
          );
        })}

        {!hasActiveAsset && (
          <div className="pt-4 mt-4 border-t border-aera-800">
            <p className="px-4 text-[10px] uppercase text-aera-500 font-bold tracking-wider mb-2 opacity-70">{t('sidebar.simulations')}</p>
            <button
              onClick={() => onChangeView(AppView.TENANT_PORTAL)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${currentView === AppView.TENANT_PORTAL
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800 shadow-inner'
                : 'hover:bg-aera-800 hover:text-white'
                }`}
            >
              <UserCircle className={`w-5 h-5 ${currentView === AppView.TENANT_PORTAL ? 'text-emerald-400' : 'text-stone-500 group-hover:text-white'}`} />
              <span className="flex-1 text-left">{t('sidebar.tenantPortal')}</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">{t('sidebar.demo')}</span>
            </button>
          </div>
        )}
      </nav>

      <div className={`${hasActiveAsset ? 'p-2' : 'p-4'} border-t border-aera-800 space-y-1 bg-aera-900/50`}>
        <button
          onClick={() => onChangeView(AppView.SETTINGS)}
          title={hasActiveAsset ? t('sidebar.settings') : undefined}
          className={`w-full flex items-center ${hasActiveAsset ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg transition-colors ${currentView === AppView.SETTINGS
            ? 'bg-aera-600/10 text-aera-500 font-medium border border-aera-600/20'
            : 'hover:bg-aera-800 hover:text-white text-stone-500'
            }`}
        >
          <Settings className={`w-5 h-5 shrink-0 ${currentView === AppView.SETTINGS ? 'text-aera-500' : 'text-stone-500'}`} />
          {!hasActiveAsset && <span>{t('sidebar.settings')}</span>}
        </button>
        <button
          onClick={logout}
          title={hasActiveAsset ? t('sidebar.logout') : undefined}
          className={`w-full flex items-center ${hasActiveAsset ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors text-stone-500`}
        >
          <LogOut className="w-5 h-5 shrink-0 group-hover:text-red-400" />
          {!hasActiveAsset && <span>{t('sidebar.logout')}</span>}
        </button>
      </div>

      {!hasActiveAsset && (
        <div className="p-6">
          <div className="bg-aera-800/50 rounded-xl p-4 border border-aera-700/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-aera-600 flex items-center justify-center text-aera-900 font-bold text-xs border-2 border-aera-500 shadow-lg">
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{userEmail}</div>
              <div className="text-xs text-aera-500 truncate">{ROLE_LABELS[role] || role} · {org.name}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
