import React, { useState } from 'react';
import { useAuthStore } from './store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, AlertCircle, ShieldCheck, User } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';

const DEV_ACCOUNTS = [
  {
    label: 'Admin',
    email: 'admin@securevault.com',
    password: 'password123',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    color: 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100',
  },
  {
    label: 'User',
    email: 'user@bank.com',
    password: 'password123',
    icon: <User className="w-3.5 h-3.5" />,
    color: 'bg-surface-50 text-surface-700 border-surface-200 hover:bg-surface-100',
  },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({ email, password });

      if (response.success) {
        const { accessToken, user } = response.data;
        setAuth(accessToken, user);
        navigate('/');
      } else {
        setError(response.error?.message || 'Authentication failed');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Cannot reach authentication server. Is the backend running?'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fillDevAccount = (acc: (typeof DEV_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-surface-50 dark:bg-surface-950 px-4 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-premium border border-surface-200 dark:border-surface-800 p-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-50 dark:bg-brand-900/30 p-5 rounded-3xl mb-6 shadow-soft ring-1 ring-brand-100">
            <Shield className="w-10 h-10 text-brand-600" />
          </div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50 tracking-tight">
            SecureVault <span className="text-brand-600">DMS</span>
          </h1>
          <p className="text-surface-500 font-medium mt-3 uppercase tracking-widest text-[11px]">
            Bank Document Integrity Pipeline
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] font-medium text-red-600 leading-tight">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-surface-400 uppercase tracking-wide ml-1">
              Work Email Address
            </label>
            <Input
              type="email"
              placeholder="you@bank.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-2xl h-14 bg-surface-50 border-surface-200 focus:bg-white text-md px-5 transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-surface-400 uppercase tracking-wide ml-1">
              Secure Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-2xl h-14 bg-surface-50 border-surface-200 focus:bg-white text-md px-5 transition-all"
              required
            />
          </div>
          <div className="pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-lg shadow-lg transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? 'Verifying Credentials...' : 'Sign In to Vault'}
            </Button>
          </div>
        </form>

        {/* Dev Quick-Login */}
        <div className="mt-8 pt-6 border-t border-surface-100 dark:border-surface-800">
          <p className="text-[11px] text-surface-400 font-semibold uppercase tracking-wider text-center mb-3">
            Dev Quick Login
          </p>
          <div className="flex gap-2">
            {DEV_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDevAccount(acc)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-semibold transition-all ${acc.color}`}
              >
                {acc.icon} {acc.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-surface-400 text-center mt-2">
            Click a role to fill credentials, then Sign In
          </p>
        </div>
      </div>
    </div>
  );
};
