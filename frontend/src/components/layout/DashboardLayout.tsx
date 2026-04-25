import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar as AdminSidebar } from './Sidebar';
import { UserSidebar } from './UserSidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '../../features/auth/store';

export const DashboardLayout = () => {
  const { user } = useAuthStore();

  return (
    <div className="flex h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface-50 via-surface-100 to-surface-200 dark:from-surface-900 dark:via-[#0c0c0e] dark:to-surface-950 overflow-hidden font-sans text-surface-900 dark:text-surface-50 antialiased selection:bg-brand-200 selection:text-brand-900">
      {user?.isMasterAdmin ? <AdminSidebar /> : <UserSidebar />}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent">
        <Topbar />
        <div className="flex-1 overflow-auto p-8 bg-white/70 backdrop-blur-3xl dark:bg-[#0c0c0e]/80 rounded-tl-2xl border-t border-l border-surface-200/50 dark:border-surface-800/50 shadow-[inset_0_2px_20px_rgba(0,0,0,0.02)] mt-2 ml-2 transition-all">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
