import React, { useState } from 'react';
import { Search, Settings, HelpCircle, LayoutGrid, LogOut, User, Bell, HardDrive, ShieldAlert, Monitor, BookOpen, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/apiClient';

export const Topbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      // Call the search API
      const response = await apiClient.get(`/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`);
      const results = response.data.data;

      toast({
        title: "Search Results",
        description: `Found ${results.totalCount} file(s) matching "${searchQuery}"`,
      });

      console.log('Search results:', results);
      
      // TODO: Navigate to search results page or show results in modal
      // navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    } catch (error: any) {
      console.error('Search failed:', error);
      toast({
        variant: "destructive",
        title: "Search Failed",
        description: error.response?.data?.error?.message || "Search temporarily unavailable",
      });
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e as any);
    }
  };

  const handleAppLauncherClick = (app: string) => {
    switch (app) {
      case 'vault':
        navigate(user?.isMasterAdmin ? '/admin/projects' : '/app/projects');
        break;
      case 'audit':
        navigate(user?.isMasterAdmin ? '/admin/audit' : '/app/recent');
        break;
      case 'directory':
        navigate(user?.isMasterAdmin ? '/admin/users' : '/app/shared');
        break;
      default:
        toast({
          title: "Feature Coming Soon",
          description: `${app} module is under development.`,
        });
    }
  };

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-surface-200 dark:border-surface-800 bg-white/80 dark:bg-surface-950/80 backdrop-blur-md sticky top-0 z-50">
      
      {/* Search Bar */}
      <div className="flex-1 max-w-2xl">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 group-focus-within:text-brand-500 transition-colors" />
          <Input 
            type="text" 
            placeholder="Search in secure vault..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full bg-surface-100 hover:bg-surface-200/50 border-transparent focus:bg-white focus:border-brand-300 focus:ring-4 focus:ring-brand-50 dark:bg-surface-900 dark:hover:bg-surface-800 dark:focus:bg-surface-900 dark:focus:border-surface-700 dark:focus:ring-surface-800 pl-10 h-10 rounded-full shadow-none text-sm transition-all duration-200"
          />
        </form>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 ml-4">
        
        {/* Help / Support Modal */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors">
              <HelpCircle className="w-6 h-6 text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 transition-colors" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Vault DMS Help Center</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
               <div className="p-4 border rounded-xl flex flex-col items-center gap-2 hover:bg-brand-50 hover:border-brand-200 cursor-pointer transition-all border-surface-200">
                 <BookOpen className="w-8 h-8 text-brand-600" />
                 <span className="text-sm font-medium text-surface-800">Documentation</span>
               </div>
               <div className="p-4 border rounded-xl flex flex-col items-center gap-2 hover:bg-surface-50 cursor-pointer transition-all border-surface-200">
                 <MessageSquare className="w-8 h-8 text-teal-600" />
                 <span className="text-sm font-medium text-surface-800">Contact IT Support</span>
               </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Modal */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors">
              <Settings className="w-6 h-6 text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 transition-colors" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Quick Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div className="flex items-center justify-between hover:bg-surface-50 p-2 rounded-lg cursor-pointer">
                 <div className="flex items-center gap-3"><Monitor className="w-5 h-5 text-surface-500" /> <span className="text-sm font-medium text-surface-800">Theme Preferences</span></div>
                 <span className="text-[11px] font-semibold tracking-wide bg-surface-100 text-surface-600 px-2.5 py-1 rounded-md">System Default</span>
               </div>
               <div className="flex items-center justify-between hover:bg-surface-50 p-2 rounded-lg cursor-pointer">
                 <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-surface-500" /> <span className="text-sm font-medium text-surface-800">Notifications</span></div>
                 <span className="text-[11px] font-semibold tracking-wide bg-brand-100 text-brand-700 px-2.5 py-1 rounded-md">Enabled</span>
               </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Layout Grid / App Launcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors">
              <LayoutGrid className="w-6 h-6 text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-4 rounded-xl border-surface-200 shadow-premium">
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => handleAppLauncherClick('vault')}
                className="flex flex-col items-center justify-center p-2 hover:bg-surface-50 rounded-xl cursor-pointer transition-colors"
              >
                <HardDrive className="w-8 h-8 text-brand-600 mb-2" /> 
                <span className="text-[11px] font-semibold text-surface-600">Vault Drive</span>
              </button>
              <button 
                onClick={() => handleAppLauncherClick('audit')}
                className="flex flex-col items-center justify-center p-2 hover:bg-surface-50 rounded-xl cursor-pointer transition-colors"
              >
                <ShieldAlert className="w-8 h-8 text-rose-600 mb-2" /> 
                <span className="text-[11px] font-semibold text-surface-600">Audit</span>
              </button>
              <button 
                onClick={() => handleAppLauncherClick('directory')}
                className="flex flex-col items-center justify-center p-2 hover:bg-surface-50 rounded-xl cursor-pointer transition-colors"
              >
                <User className="w-8 h-8 text-teal-600 mb-2" /> 
                <span className="text-[11px] font-semibold text-surface-600">Directory</span>
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* User Profile Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-medium cursor-pointer ml-3 shadow-md hover:shadow-lg hover:scale-105 transition-all ring-[2px] ring-white dark:ring-surface-900 border border-brand-200">
              {user?.name.charAt(0)}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 mt-2 rounded-xl border-surface-200 shadow-premium">
            <div className="px-4 py-4 flex flex-col items-center justify-center border-b border-surface-100 mb-2 bg-surface-50/50 rounded-t-xl">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-medium text-xl mb-3 shadow-inner ring-4 ring-white">
                {user?.name.charAt(0)}
              </div>
              <p className="text-[15px] font-semibold text-surface-900">{user?.name}</p>
              <p className="text-xs text-surface-500 font-medium">{user?.email}</p>
              {user?.isMasterAdmin && (
                <span className="mt-3 text-[10px] uppercase font-bold bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1 rounded-full tracking-wide">
                   Master Admin
                </span>
              )}
            </div>
            
            <DropdownMenuItem className="cursor-pointer py-2.5 px-4 font-medium text-sm text-surface-700 hover:text-surface-900">
              <User className="w-4 h-4 mr-3 text-surface-400" /> Account Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-surface-100 my-1"/>
            <DropdownMenuItem className="cursor-pointer text-red-600 py-2.5 px-4 focus:bg-red-50 focus:text-red-700 font-medium text-sm rounded-b-lg" onSelect={handleLogout}>
              <LogOut className="w-4 h-4 mr-3" /> Sign out securely
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
};