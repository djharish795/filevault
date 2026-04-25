import React from 'react';
import { Outlet } from 'react-router-dom';
import { UserSidebar } from './UserSidebar';
import { Topbar } from './Topbar';

export const UserLayout = () => {
  return (
    <div className="flex h-screen w-full bg-surface-50 dark:bg-surface-950 overflow-hidden font-sans text-surface-900 dark:text-surface-50 antialiased selection:bg-brand-200 selection:text-brand-900">
      <div className="flex-shrink-0">
        <UserSidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 bg-surface-50 dark:bg-surface-950">
        <Topbar />
        
        {/* User Content Area - Clean, minimal, stark feel */}
        <div className="flex-1 overflow-auto p-8 bg-white dark:bg-surface-900 rounded-tl-[1.5rem] border-t border-l border-surface-200 dark:border-surface-800 shadow-soft mt-2 ml-2">
          <div className="max-w-5xl mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
