import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Plus, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewDropdownTrigger } from '@/features/files/components/UploadModal';

export const AdminSidebar = () => {
  return (
    <aside className="w-[240px] bg-white dark:bg-surface-950 border-r border-surface-200/60 dark:border-surface-800/60 flex flex-col h-full text-surface-700 dark:text-surface-300">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 text-xl font-medium text-surface-900 dark:text-surface-50 tracking-tight gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-soft">
          <Shield className="text-white w-5 h-5" />
        </div>
        File Vault
      </div>

      {/* New Button */}
      <div className="px-5 py-4">
        <NewDropdownTrigger>
          <Button
            className="rounded-2xl h-[52px] px-5 w-full shadow-premium gap-3 text-[15px] font-medium transition-all hover:scale-[1.01] bg-white dark:bg-surface-800 border border-surface-200 text-surface-900 dark:text-surface-50 flex items-center justify-start"
            variant="outline"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30">
              <Plus className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            create new
          </Button>
        </NewDropdownTrigger>
      </div>

      {/* Navigation — only 2 items */}
      <nav className="flex-1 px-4 mt-2 space-y-1">
        <NavLinkItem to="/admin/projects" icon={<Plus className="w-[18px] h-[18px]" />} label="All projects" />
        <NavLinkItem to="/admin/users" icon={<Users className="w-[18px] h-[18px]" />} label="Create Users" />
      </nav>
    </aside>
  );
};

const NavLinkItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 text-[14px] font-medium tracking-tight
       ${isActive
         ? 'bg-gradient-to-r from-brand-50 to-brand-100/50 text-brand-700 shadow-[inset_2px_0_0_0_#e35336] dark:from-brand-900/40 dark:to-brand-900/10 dark:text-brand-100'
         : 'text-surface-600 hover:bg-surface-100/80 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-900/50 dark:hover:text-surface-100'}`
    }
  >
    {icon} {label}
  </NavLink>
);
