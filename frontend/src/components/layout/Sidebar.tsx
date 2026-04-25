import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Plus, Home, HardDrive, Users, Clock, Star, Trash2, Cloud, Shield
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAuthStore } from '../../features/auth/store';
import { UploadModal } from '../../features/files/components/UploadModal';

export const Sidebar = () => {
  const { user } = useAuthStore();
  const canUpload = user?.isMasterAdmin || true; // Check real permissions here
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <aside className="w-64 border-r bg-slate-50 dark:bg-slate-950 flex flex-col h-full text-slate-700 dark:text-slate-300">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 text-xl font-medium text-slate-800 dark:text-slate-100">
        <Shield className="mr-2 text-primary w-6 h-6" /> Vault DMS
      </div>

      {/* New Action Button Placeholder / Padding */}
      <div className="px-4 py-4 min-h-[5.5rem]">
         {/* The Global 'New' button has been intentionally removed as per architecture rules. 
             Uploads MUST occur within strict Project Views. */}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 mt-2">
        <NavLinkItem to="/dashboard" icon={<Home className="w-5 h-5"/>} label="Home" />
        <NavLinkItem to="/projects" icon={<HardDrive className="w-5 h-5"/>} label="My Projects" />
        <NavLinkItem to="/shared" icon={<Users className="w-5 h-5"/>} label="Shared with me" />
        <NavLinkItem to="/recent" icon={<Clock className="w-5 h-5"/>} label="Recent" />
        <NavLinkItem to="/starred" icon={<Star className="w-5 h-5"/>} label="Starred" />
        
        <div className="my-4 border-t border-slate-200 dark:border-slate-800 mx-3"></div>
        
        <NavLinkItem to="/trash" icon={<Trash2 className="w-5 h-5"/>} label="Bin" />
      </nav>

      {/* Storage Indicator */}
      <div className="p-4 mt-auto">
        <div className="flex items-center gap-2 px-3 py-2 text-sm">
          <Cloud className="w-5 h-5" /> Storage
        </div>
        <div className="px-3">
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 dark:bg-slate-800">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: '45%' }}></div>
          </div>
          <p className="text-xs mt-2 text-slate-500">45 GB of 100 GB used</p>
          <Button variant="outline" className="w-full mt-4 text-xs h-8 rounded-full border-primary/20 text-primary hover:bg-primary/5">
            Request storage
          </Button>
        </div>
      </div>
    </aside>
  );
};

const NavLinkItem = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) => 
      `flex items-center gap-3.5 px-3 py-2 rounded-lg transition-all duration-200 text-[14px] font-medium tracking-tight
       ${isActive 
         ? 'bg-gradient-to-r from-brand-50 to-brand-100/50 text-brand-700 shadow-soft dark:from-brand-900/40 dark:to-brand-900/10 dark:text-brand-100 border border-brand-200/50 dark:border-brand-800/50' 
         : 'text-surface-600 hover:bg-surface-100/80 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-900/50 dark:hover:text-surface-100 border border-transparent'}`
    }
  >
    {icon} {label}
  </NavLink>
);
