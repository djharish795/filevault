import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { Topbar } from './Topbar';

export const AdminLayout = () => {
  return (
    <div className="flex h-screen w-full bg-surface-50 dark:bg-surface-950 overflow-hidden font-sans text-surface-900 dark:text-surface-50 antialiased selection:bg-brand-200 selection:text-brand-900 relative">
      {/* Ambient background mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="flex-shrink-0">
        <AdminSidebar />
      </div>
      
      <main className="flex-1 flex flex-col min-w-0 bg-transparent z-10">
        <Topbar />
        
        {/* Admin Content Area - Wider, more functional feel */}
        <div className="flex-1 overflow-auto p-8 bg-white/40 backdrop-blur-xl dark:bg-surface-900/40 rounded-tl-[2rem] border-t border-l border-surface-200/50 dark:border-surface-800/50 shadow-premium mt-2 ml-2">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
