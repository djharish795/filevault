import React from 'react';
import { NavLink } from 'react-router-dom';
import { HardDrive, Shield } from 'lucide-react';

export const UserSidebar = () => {
  return (
    <aside className="w-56 border-r border-surface-200/50 bg-transparent flex flex-col h-full text-surface-700 dark:text-surface-300">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 text-[17px] font-semibold text-surface-900 dark:text-surface-50 tracking-tight gap-2 border-b border-surface-200/40">
        <Shield className="text-brand-600 w-5 h-5 shadow-sm" /> Vault DMS
      </div>

      {/* Navigation — only 1 item */}
      <nav className="flex-1 px-3 space-y-1 mt-6">
        <NavLinkItem to="/app/shared" icon={<HardDrive className="w-4 h-4" />} label="My Projects" />
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto mb-2 text-center text-[10px] text-surface-400 font-medium">
        Secure Bank Portal ver 1.0.4
      </div>
    </aside>
  );
};

const NavLinkItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium tracking-tight
       ${isActive
         ? 'bg-brand-50/80 text-brand-700 border border-brand-200/50 dark:bg-brand-900/40 dark:text-brand-100 dark:border-brand-800/50 shadow-soft'
         : 'text-surface-600 hover:bg-surface-100/80 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-900/50 dark:hover:text-surface-100 border border-transparent'}`
    }
  >
    {icon} {label}
  </NavLink>
);
