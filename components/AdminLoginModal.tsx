import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, Mail, ArrowRight, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { UserAccount } from './PremiumAuthModal';
import {
  signInAdminWithSupabase,
  checkCurrentAdminSession,
  signInWithGoogle,
} from '../utils/userAuthService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminLoginSuccess: (account: UserAccount) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onAdminLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeAdminAccount, setActiveAdminAccount] = useState<UserAccount | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  // Check for an active Supabase session for an administrator when modal opens
  useEffect(() => {
    if (!isOpen) {
      setActiveAdminAccount(null);
      setErrorMessage('');
      return;
    }

    let isMounted = true;
    const inspectSession = async () => {
      setIsCheckingSession(true);
      try {
        const check = await checkCurrentAdminSession();
        if (isMounted && check.isAdmin && check.account) {
          setActiveAdminAccount(check.account);
        }
      } catch (err) {
        console.warn('Error inspecting admin session:', err);
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    };

    inspectSession();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    soundManager.playPop();
    setEmail('');
    setPassword('');
    setErrorMessage('');
    onClose();
  };

  const handleUseActiveSession = () => {
    if (!activeAdminAccount) return;
    soundManager.playSuccess();
    soundManager.speak('Administrator access confirmed.');
    onAdminLoginSuccess(activeAdminAccount);
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    soundManager.playPop();

    try {
      const res = await signInWithGoogle();
      if (res?.error) {
        setIsLoading(false);
        setErrorMessage(res.error.message || 'Google sign-in failed. Please try again.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Google sign-in failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid administrator email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsLoading(true);
    soundManager.playPop();

    try {
      const res = await signInAdminWithSupabase(cleanEmail, password);
      setIsLoading(false);

      if (!res.success || !res.account) {
        soundManager.playPop();
        setErrorMessage(res.error || 'Authentication failed. Please verify your credentials.');
        return;
      }

      soundManager.playSuccess();
      soundManager.speak('Administrator access granted.');
      onAdminLoginSuccess(res.account);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      <div
        id="admin-login-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto select-none"
      >
        <motion.div
          id="admin-login-dialog"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white border-4 border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto text-slate-800"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white text-center relative border-b-4 border-slate-800">
            <button
              id="admin-login-close-btn"
              onClick={handleClose}
              type="button"
              className="absolute top-3.5 right-3.5 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition-colors cursor-pointer"
              title="Close Dialog"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="inline-flex items-center justify-center w-13 h-13 bg-amber-400 border-3 border-white rounded-2xl mb-2.5 shadow-md text-slate-950">
              <ShieldCheck className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div className="inline-block bg-amber-400/20 text-amber-300 font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider mb-1 border border-amber-400/30">
              Security Clearance
            </div>

            <h2 className="text-xl font-black uppercase tracking-tight text-white drop-shadow-sm">
              Administrator Login
            </h2>
            <p className="text-xs font-medium text-slate-300 mt-0.5">
              Direct Supabase Authentication
            </p>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-4">
            {/* Active Session Fast Access */}
            {activeAdminAccount && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-extrabold text-emerald-950 block">
                      Active Supabase Admin Session Found
                    </span>
                    <span className="font-bold text-emerald-800 truncate block">
                      {activeAdminAccount.email}
                    </span>
                  </div>
                </div>
                <button
                  id="admin-continue-active-session-btn"
                  type="button"
                  onClick={handleUseActiveSession}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-3 rounded-xl border-b-3 border-emerald-900 shadow-xs text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:translate-y-0.5"
                >
                  <span>Continue to Admin Area</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-600 font-medium">
                Authorized administrator accounts only (<code className="font-bold text-slate-800">admin</code> / <code className="font-bold text-slate-800">super_admin</code>).
              </p>
            </div>

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="admin-email-input"
                  className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1"
                >
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="admin-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="admin@playroom.edu"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="admin-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl border border-slate-300 active:translate-y-0.5 text-xs uppercase tracking-wide transition-all cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  id="admin-login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-xl border-b-4 border-indigo-900 active:border-b-0 active:translate-y-0.5 shadow-md text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as Admin</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Alternate Google OAuth Sign In for Supabase-linked accounts */}
            <div className="pt-2 border-t border-slate-200">
              <button
                id="admin-google-auth-btn"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-xl border border-slate-300 shadow-2xs text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google (Supabase Account)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
