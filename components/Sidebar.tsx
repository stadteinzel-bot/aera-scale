
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, Wallet, Settings, LogOut,
  UserCircle, FileText, Wrench, BarChart3
} from 'lucide-react';
import { AppView } from '../types';
import { useAuth } from '../services/AuthContext';
import { useOrg } from '../services/OrgContext';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  hasActiveAsset?: boolean;
}

// ── AERA SCALE SVG Logo Mark ──────────────────────────────────────
const LogoMark: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8"  y="24" width="20" height="32" rx="2" fill="rgba(255,255,255,0.85)"/>
    <rect x="16" y="12" width="32" height="44" rx="2" fill="rgba(255,255,255,0.50)"/>
    <rect x="36" y="20" width="20" height="36" rx="2" fill="rgba(255,255,255,0.75)"/>
    {/* Gold accent squares */}
    <rect x="14" y="30" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="14" y="41" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="26" y="22" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="26" y="33" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="26" y="44" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="43" y="28" width="5" height="5" rx="1" fill="#C9A84C"/>
    <rect x="43" y="39" width="5" height="5" rx="1" fill="#C9A84C"/>
  </svg>
);

// ── Nav Button with Tooltip ───────────────────────────────────────
interface NavBtnProps {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  danger?: boolean;
  onClick: () => void;
}

const NavBtn: React.FC<NavBtnProps> = ({ label, icon: Icon, isActive, danger, onClick }) => (
  <div className="relative group" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
    <button
      onClick={onClick}
      title={label}
      className="nav-icon"
      style={{
        color: isActive
          ? '#C9A84C'
          : danger
            ? 'rgba(201,74,58,0.5)'
            : '#7A9589',
        background: isActive ? 'rgba(201,168,76,0.12)' : undefined,
      }}
    >
      {isActive && (
        <motion.div
          layoutId="nav-active-bg"
          className="absolute inset-0 rounded-xl"
          style={{ background: 'rgba(201,168,76,0.12)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {isActive && (
        <motion.div
          layoutId="nav-active-bar"
          style={{
            position: 'absolute', left: '-16px', top: '50%',
            transform: 'translateY(-50%)',
            width: '2px', height: '24px',
            background: '#C9A84C', borderRadius: '0 2px 2px 0',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <Icon
        size={20}
        style={{
          position: 'relative', zIndex: 1,
          color: isActive ? '#C9A84C' : danger ? 'rgba(201,74,58,0.55)' : '#7A9589',
        }}
      />
    </button>

    {/* Hover tooltip */}
    <div style={{
      position: 'absolute', left: '100%', marginLeft: '12px',
      top: '50%', transform: 'translateY(-50%)',
      pointerEvents: 'none', zIndex: 50,
      opacity: 0, transition: 'opacity 150ms ease',
    }}
      className="group-hover:opacity-100"
    >
      <div style={{
        background: '#1E3329', border: '1px solid rgba(45,74,62,0.8)',
        color: 'white', fontSize: '12px', fontWeight: 500,
        padding: '5px 10px', borderRadius: '8px',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(45,74,62,0.25)',
      }}>
        {label}
      </div>
    </div>
  </div>
);

// ── Sidebar Component ─────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, hasActiveAsset }) => {
  const { user, logout } = useAuth();
  const { role, org } = useOrg();
  const userEmail   = user?.email || 'User';
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  const ROLE_LABELS: Record<string, string> = {
    org_admin:       'Admin',
    user:            'Benutzer',
    finance:         'Finanzen',
    property_manager:'Objektverwalter',
  };

  const mainNav = [
    { id: AppView.DASHBOARD,  label: 'Dashboard',    icon: LayoutDashboard },
    { id: AppView.PROPERTIES, label: 'Objekte',      icon: Building2 },
    { id: AppView.TENANTS,    label: 'Mieter',       icon: Users },
    { id: AppView.FINANCE,    label: 'Finanzen',     icon: Wallet },
  ];

  return (
    <div style={{
      width: '72px',
      background: '#2D4A3E',   /* ANTIGRAVITY v2: forest #2D4A3E */
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: '1px solid rgba(45,74,62,0.6)',
      flexShrink: 0,
    }}>

      {/* ── Logo ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <LogoMark size={36} />
      </div>

      {/* ── Main Nav ── */}
      <nav style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '4px',
        padding: '16px 14px', overflowY: 'auto',
      }}>
        {mainNav.map(item => (
          <NavBtn
            key={item.id}
            label={item.label}
            icon={item.icon}
            isActive={currentView === item.id && !hasActiveAsset}
            onClick={() => onChangeView(item.id)}
          />
        ))}

        {/* Divider */}
        <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

        <NavBtn
          label="Mieter-Portal"
          icon={UserCircle}
          isActive={currentView === AppView.TENANT_PORTAL}
          onClick={() => onChangeView(AppView.TENANT_PORTAL)}
        />
      </nav>

      {/* ── Bottom ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '4px', padding: '12px 14px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <NavBtn
          label="Einstellungen"
          icon={Settings}
          isActive={currentView === AppView.SETTINGS}
          onClick={() => onChangeView(AppView.SETTINGS)}
        />
        <NavBtn
          label="Abmelden"
          icon={LogOut}
          isActive={false}
          danger
          onClick={logout}
        />

        {/* User avatar */}
        <div
          title={`${userEmail}\n${ROLE_LABELS[role] || role} · ${org.name}`}
          style={{
            marginTop: '8px',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(201,168,76,0.15)',
            border: '1.5px solid rgba(201,168,76,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px', fontWeight: 600, color: '#C9A84C',
            cursor: 'default', userSelect: 'none',
          }}
        >
          {userInitials}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
