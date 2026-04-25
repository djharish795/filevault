import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, Send } from 'lucide-react';
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

interface User {
  id: string;
  name: string;
  email: string;
}

interface FileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
}

const avatarColor = (name: string) => {
  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600'];
  return colors[name.charCodeAt(0) % colors.length];
};

export const FileShareModal = ({ isOpen, onClose, fileId, fileName }: FileShareModalProps) => {
  const { user: currentUser } = useAuthStore();
  const { toast } = useToast();
  const { id: projectId } = useParams();

  // ─── State resets completely when fileId changes ──────────────────────────────
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [alreadyShared, setAlreadyShared] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Reset ALL state when a new file is opened — this is the core fix
  useEffect(() => {
    if (!isOpen || !fileId || !projectId) return;

    // Hard reset — no state carries over from previous file
    setSelected(new Set());
    setSearch('');
    setAlreadyShared(new Set());
    setAllUsers([]);
    setIsLoading(true);

    // Fetch all project members (potential recipients)
    const fetchUsers = apiClient
      .get(`/projects/${projectId}/sharing`)
      .then(res => {
        const members: any[] = res.data.data.people ?? [];
        // Exclude admin (owner) from the list
        const nonAdmins = members.filter(m => !m.isOwner);
        setAllUsers(nonAdmins.map(m => ({ id: m.userId, name: m.name, email: m.email })));
      });

    // Fetch who already has access to THIS specific file
    const fetchAccess = apiClient
      .get(`/projects/${projectId}/sharing/files/${fileId}/access`)
      .then(res => {
        const shared: any[] = res.data.data.sharedWith ?? [];
        setAlreadyShared(new Set(shared.map((u: any) => u.id)));
      })
      .catch(() => {
        // Endpoint may not exist yet — ignore, treat as no existing access
        setAlreadyShared(new Set());
      });

    Promise.all([fetchUsers, fetchAccess]).finally(() => setIsLoading(false));
  }, [isOpen, fileId, projectId]); // ← fileId in deps = fresh state per file

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const handleShare = async () => {
    if (!projectId || selected.size === 0) return;
    setIsSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const userId of Array.from(selected)) {
      try {
        await apiClient.post(`/projects/${projectId}/sharing/files/${fileId}/share`, { userId });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        variant: 'success',
        title: 'File shared',
        description: `"${fileName}" shared with ${successCount} user${successCount > 1 ? 's' : ''}.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
      });
    } else {
      toast({ variant: 'destructive', title: 'Share failed', description: 'Could not share file. Try again.' });
    }

    setIsSending(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border dark:border-slate-800 p-0 overflow-hidden shadow-2xl rounded-xl">
        <DialogHeader className="px-6 py-4 border-b dark:border-slate-800">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-brand-600" /> Share file
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 truncate">
            "{fileName}" — select who can see this file
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 text-sm"
            autoFocus
          />
        </div>

        {/* User list — fresh per file, no pre-selection */}
        <div className="px-6 pb-2 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              {allUsers.length === 0 ? 'No users in this project yet.' : 'No users match your search.'}
            </p>
          ) : (
            <div className="space-y-1 py-1">
              {filteredUsers.map(u => {
                const isChecked = selected.has(u.id);
                const hasAccess = alreadyShared.has(u.id);

                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                      isChecked
                        ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full ${avatarColor(u.name)} text-white flex items-center justify-center font-semibold text-sm shrink-0`}>
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {u.email}
                        {hasAccess && <span className="ml-2 text-green-600 font-medium">· already has access</span>}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isChecked ? 'bg-brand-600 border-brand-600' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-slate-800 flex justify-between items-center">
          <span className="text-sm text-slate-500">
            {selected.size > 0 ? `${selected.size} user${selected.size > 1 ? 's' : ''} selected` : 'Select users to share with'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSending} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleShare}
              disabled={isSending || selected.size === 0}
              className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 gap-2"
            >
              {isSending ? <><Loader2 className="w-4 h-4 animate-spin" />Sharing...</> : <><Send className="w-4 h-4" />Share</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
