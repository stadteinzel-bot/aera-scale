
import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Building2, Users, Settings, LogOut, UserCircle, Wallet } from 'lucide-react';
import { AppView } from '../types';
import { useAuth } from '../services/AuthContext';
import { useOrg } from '../services/OrgContext';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  hasActiveAsset?: boolean;
}

// Inline SVG Logo Icon (hexagon A-mark)
const LogoIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" rx="10" fill="#0D2818"/>
    <g transform="translate(4,4)">
      <rect x="10" y="28" width="7" height="24" fill="#C9A84C"/>
      <rect x="39" y="28" width="7" height="24" fill="#C9A84C"/>
      <polygon points="13,28 28,8 31,8 31,14 16,32" fill="#C9A84C"/>
      <polygon points="43,28 28,8 25,8 25,14 40,32" fill="#C9A84C"/>
      <rect x="18" y="36" width="20" height="5" fill="#C9A84C"/>
    </g>
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, hasActiveAsset }) => {
  const { user, logout } = useAuth();
  const { role, org } = useOrg();
  const userEmail = user?.email || 'User';
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  const navItems = [
    { id: AppView.DASHBOARD,   label: 'Dashboard',   icon: LayoutDashboard },
    { id: AppView.PROPERTIES,  label: 'Immobilien',  icon: Building2 },
    { id: AppView.TENANTS,     label: 'Mieter',      icon: Users },
    { id: AppView.FINANCE,     label: 'Finanzen',    icon: Wallet },
  ];

  const NavButton: React.FC<{
    id: AppView | 'settings' | 'portal';
    label: string;
    icon: React.ElementType;
    active?: boolean;
    danger?: boolean;
    onClick: () => void;
  }> = ({ label, icon: Icon, active, danger, onClick }) => (
    <div className="relative group">
      <button
        onClick={onClick}
        title={label}
        className={`
          relative w-full flex items-center justify-center h-11 w-11 mx-auto rounded-xl transition-all duration-200
          ${active
            ? 'bg-gold-500/10 text-gold-500'
            : danger
              ? 'text-aera-400/50 hover:text-red-400 hover:bg-red-900/20'
              : 'text-aera-400/50 hover:text-white hover:bg-aera-800'
          }
        `}
      >
        {active && (
          <motion.div
            layoutId="nav-active-bg"
            className="absolute inset-0 bg-gold-500/10 rounded-xl"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        {active && (
          <motion.div
            layoutId="nav-active-bar"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gold-500 rounded-r-full"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Icon className="w-5 h-5 relative z-10" />
      </button>
      {/* Tooltip */}
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        <div className="bg-aera-900 border border-aera-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
          {label}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-[72px] bg-aera-900 flex flex-col h-full border-r border-aera-800/80 shrink-0">

      {/* Logo */}
      <div className="flex items-center justify-center py-5 border-b border-aera-800/60">
        <LogoIcon size={36} />
      </div>

      {/* Main Nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 py-4 px-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id && !hasActiveAsset;
          return (
            <NavButton
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              active={isActive}
              onClick={() => onChangeView(item.id)}
            />
          );
        })}

        {/* Divider */}
        <div className="w-8 h-px bg-aera-800/60 my-2" />

        {/* Tenant Portal shortcut */}
        <NavButton
          id="portal"
          label="Mieter-Portal"
          icon={UserCircle}
          active={currentView === AppView.TENANT_PORTAL}
          onClick={() => onChangeView(AppView.TENANT_PORTAL)}
        />
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-1 px-1.5 py-3 border-t border-aera-800/60">
        <NavButton
          id="settings"
          label="Einstellungen"
          icon={Settings}
          active={currentView === AppView.SETTINGS}
          onClick={() => onChangeView(AppView.SETTINGS)}
        />
        <NavButton
          id="settings"
          label="Abmelden"
          icon={LogOut}
          danger
          onClick={logout}
        />
        {/* User Avatar */}
        <div
          title={`${userEmail}\n${role} · ${org.name}`}
          className="mt-2 w-9 h-9 rounded-full bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-400 font-semibold text-xs cursor-default select-none"
        >
          {userInitials}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
