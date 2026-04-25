import React, { useState, useEffect, useRef } from 'react';
import { Link as LinkIcon, X, Loader2, Check, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/store';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/apiClient';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

interface Person {
  userId: string;
  name: string;
  email: string;
  isOwner?: boolean;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  projectId?: string;
}

const avatarColor = (name: string) => {
  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600'];
  return colors[name.charCodeAt(0) % colors.length];
};

export const ShareModal = ({ isOpen, onClose, fileName, projectId: propProjectId }: ShareModalProps) => {
  const { user: currentUser } = useAuthStore();
  const { toast } = useToast();
  const { id: routeProjectId } = useParams();
  const queryClient = useQueryClient();
  const projectId = propProjectId ?? routeProjectId;

  const [people, setPeople] = useState<Person[]>([]);
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load people with access
  useEffect(() => {
    if (!isOpen || !projectId) return;
    setIsLoading(true);
    apiClient
      .get(`/projects/${projectId}/sharing`)
      .then(res => setPeople(res.data.data.people))
      .catch(() => toast({ variant: 'destructive', title: 'Failed to load access list' }))
      .finally(() => setIsLoading(false));
  }, [isOpen, projectId]);

  // Load users not yet in project (admin only)
  useEffect(() => {
    if (!isOpen || !projectId || !currentUser?.isMasterAdmin) return;
    apiClient
      .get(`/projects/${projectId}/sharing/search-users`)
      .then(res => setSearchUsers(res.data.data.users))
      .catch(() => {});
  }, [isOpen, projectId]);

  const suggestions = inputValue.trim().length > 0
    ? searchUsers.filter(u =>
        u.name.toLowerCase().includes(inputValue.toLowerCase()) ||
        u.email.toLowerCase().includes(inputValue.toLowerCase())
      )
    : [];

  // Add user — no role, just grant access
  const handleAddUser = async (email: string) => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const res = await apiClient.post(`/projects/${projectId}/sharing`, { email });
      const newPerson = res.data.data;
      setPeople(prev => [...prev, newPerson]);
      setSearchUsers(prev => prev.filter(u => u.email !== email));
      setInputValue('');
      setShowDropdown(false);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ variant: 'success', title: 'Access granted', description: `${newPerson.name} can now access this project.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to add user', description: err.response?.data?.error?.message ?? 'Something went wrong' });
    } finally {
      setIsSaving(false);
    }
  };

  // Remove access
  const handleRemoveAccess = async (userId: string, name: string) => {
    if (!projectId) return;
    try {
      await apiClient.delete(`/projects/${projectId}/sharing/${userId}`);
      setPeople(prev => prev.filter(p => p.userId !== userId));
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ variant: 'success', title: 'Access removed', description: `${name} no longer has access` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to remove access', description: err.response?.data?.error?.message ?? 'Something went wrong' });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = currentUser?.isMasterAdmin;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border dark:border-slate-800 p-0 overflow-hidden shadow-2xl rounded-xl">

        <DialogHeader className="px-6 py-4 border-b dark:border-slate-800">
          <DialogTitle className="text-xl font-medium truncate">Share '{fileName}'</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-0.5">
            People with access can view and upload files in this project.
          </DialogDescription>
        </DialogHeader>

        {/* Add People Input — admin only */}
        {isAdmin && (
          <div className="p-6 pb-2 relative">
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Add people by name or email..."
                className="h-11 text-sm border-slate-300 dark:border-slate-700 pr-10"
                disabled={isSaving}
              />
              <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

              {/* Suggestions dropdown */}
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {suggestions.map(u => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors"
                      onMouseDown={e => { e.preventDefault(); handleAddUser(u.email); }}
                    >
                      <div className={`w-8 h-8 rounded-full ${avatarColor(u.name)} text-white flex items-center justify-center text-sm font-medium shrink-0`}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add by exact email if no suggestion matched */}
            {inputValue.includes('@') && suggestions.length === 0 && (
              <button
                className="mt-2 text-sm text-brand-600 hover:underline"
                onClick={() => handleAddUser(inputValue.trim())}
                disabled={isSaving}
              >
                {isSaving ? 'Adding...' : `Add "${inputValue.trim()}"`}
              </button>
            )}
          </div>
        )}

        {/* People with access */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">People with access</h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : people.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No one has access yet.</p>
          ) : (
            <div className="space-y-3">
              {people.map(person => {
                const isYou = person.email === currentUser?.email;
                const isOwnerRow = person.isOwner || (isYou && currentUser?.isMasterAdmin);

                return (
                  <div key={person.userId} className="flex items-center justify-between gap-3">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className={`w-9 h-9 rounded-full ${avatarColor(person.name)} text-white flex items-center justify-center font-medium text-sm shrink-0`}>
                        {person.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {person.name}{isYou && ' (you)'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{person.email}</p>
                      </div>
                    </div>

                    {isOwnerRow ? (
                      <span className="text-sm text-slate-500 font-medium px-2 shrink-0">Owner</span>
                    ) : isAdmin ? (
                      <button
                        onClick={() => handleRemoveAccess(person.userId, person.name)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 px-2 shrink-0">Has access</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-zinc-900/50 flex justify-between items-center">
          <Button variant="outline" className="rounded-full shadow-sm" onClick={handleCopyLink}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <LinkIcon className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          <Button className="rounded-full px-6 bg-brand-600 hover:bg-brand-700 text-white" onClick={onClose}>
            Done
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
