import React, { useState, useEffect } from 'react';
import { Plus, Loader2, KeyRound, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/apiClient';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  isMasterAdmin: boolean;
  createdAt: string;
}

const avatarColor = (name: string) => {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500'];
  return colors[name.charCodeAt(0) % colors.length];
};

export const UserManagementPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create user form
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data.data.users);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load users' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // ─── Validate create form ─────────────────────────────────────────────────────
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format';
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 6) errors.password = 'Minimum 6 characters';
    if (form.password !== form.confirm) errors.confirm = 'Passwords do not match';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Create user ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!validateForm()) return;
    setIsCreating(true);
    try {
      await apiClient.post('/admin/users', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      toast({ variant: 'success', title: 'User created', description: `${form.name} can now log in.` });
      setForm({ name: '', email: '', password: '', confirm: '' });
      setFormErrors({});
      setCreateOpen(false);
      loadUsers();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message ?? 'Failed to create user';
      if (msg.toLowerCase().includes('email')) {
        setFormErrors(prev => ({ ...prev, email: 'This email is already registered' }));
      } else {
        toast({ variant: 'destructive', title: 'Create failed', description: msg });
      }
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Reset password ───────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Minimum 6 characters' });
      return;
    }
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      await apiClient.patch(`/admin/users/${resetTarget.id}/password`, { password: newPassword });
      toast({ variant: 'success', title: 'Password reset', description: `Password updated for ${resetTarget.name}` });
      setResetOpen(false);
      setNewPassword('');
      setResetTarget(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Reset failed', description: err.response?.data?.error?.message ?? 'Failed to reset password' });
    } finally {
      setIsResetting(false);
    }
  };

  // ─── Delete user ──────────────────────────────────────────────────────────────
  const handleDelete = async (user: UserRecord) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/admin/users/${user.id}`);
      toast({ variant: 'success', title: 'User deleted', description: `${user.name} has been removed.` });
      loadUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.response?.data?.error?.message ?? 'Failed to delete user' });
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-100">User Management</h1>
        <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5">
          <Plus className="w-4 h-4" /> Create User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 rounded-xl">
          <p className="text-surface-400">No users yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 rounded-xl border border-surface-200 bg-white dark:bg-surface-900 shadow-soft">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(u.name)} text-white flex items-center justify-center font-semibold text-sm`}>
                  {u.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    {u.name}
                    {u.isMasterAdmin && <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>}
                  </p>
                  <p className="text-xs text-surface-500">{u.email}</p>
                </div>
              </div>
              {!u.isMasterAdmin && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1.5 text-xs"
                    onClick={() => { setResetTarget(u); setNewPassword(''); setResetOpen(true); }}
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-red-600 border-red-200 hover:bg-red-50 gap-1.5 text-xs"
                    onClick={() => handleDelete(u)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Create User Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) { setCreateOpen(false); setFormErrors({}); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" /> Create New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Input placeholder="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} disabled={isCreating} />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <Input placeholder="Email address" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={isCreating} />
              {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <Input placeholder="Password (min 6 chars)" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} disabled={isCreating} />
              {formErrors.password && <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>}
            </div>
            <div>
              <Input placeholder="Confirm password" type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} disabled={isCreating} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              {formErrors.confirm && <p className="text-xs text-red-500 mt-1">{formErrors.confirm}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-100">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={isCreating} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating} className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5">
              {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Reset Password Dialog ───────────────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={open => { if (!open) { setResetOpen(false); setNewPassword(''); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-600" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-surface-500 mt-1">
            Setting new password for <strong>{resetTarget?.name}</strong>
          </p>
          <Input
            placeholder="New password (min 6 chars)"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            disabled={isResetting}
            onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
            className="mt-3"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-100">
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={isResetting} className="rounded-xl">Cancel</Button>
            <Button onClick={handleResetPassword} disabled={isResetting || !newPassword} className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5">
              {isResetting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting...</> : 'Reset Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
