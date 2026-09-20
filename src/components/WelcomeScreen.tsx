import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Volume2, Sparkles, Heart, User, CheckCircle2 } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { UserAccount } from './PremiumAuthModal';

// =========================================================================
// DEMO TOGGLE: Set SHOW_GOOGLE_LOGIN = true to restore Google Login button
// =========================================================================
export const SHOW_GOOGLE_LOGIN = false;

interface WelcomeScreenProps {
  onStart: () => void;
  userAccount: UserAccount | null;
  onContinueWithGoogle: () => Promise<void>;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  userAccount,
  onContinueWithGoogle,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Play warm child voice welcome message when Welcome Screen opens
  useEffect(() => {
    soundManager.speak("Welcome to Playroom! Let's Learn Through Play!");
  }, []);

  const handleHearWelcome = () => {
    soundManager.playPop();
    soundManager.speak("Welcome to Playroom! Let's Learn Through Play!");
  };

  const handleGoogleLogin = async () => {
    soundManager.playPop();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await onContinueWithGoogle();
    } catch (err: any) {
      setLoginError(err.message || 'Could not start Google sign in. Please try again.');
      setIsLoggingIn(false);
    }
  };

  const handleStart = () => {
    soundManager.playPop();
    soundManager.speak("Let's play!");
    onStart();
  };

  return (
    <div id="welcome-screen" className="w-full max-w-4xl mx-auto p-4 sm:p-6 text-center select-none">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
        className="relative bg-gradient-to-b from-[#BAE6FD] via-[#E0F2FE] to-[#FEF08A] rounded-3xl border-8 border-white shadow-2xl p-6 sm:p-12 overflow-hidden flex flex-col items-center justify-center min-h-[520px]"
      >
        {/* Floating background decorative items */}
        <motion.div
          animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-6 left-8 text-4xl sm:text-5xl opacity-80 pointer-events-none"
        >
          🎈
        </motion.div>
        <motion.div
          animate={{ y: [-8, 8, -8] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-10 left-10 text-4xl sm:text-5xl opacity-80 pointer-events-none"
        >
          🎨
        </motion.div>
        <motion.div
          animate={{ y: [8, -8, 8] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-8 right-12 text-4xl sm:text-5xl opacity-80 pointer-events-none"
        >
          🧩
        </motion.div>

        {/* Playroom Logo Badge */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="inline-flex items-center gap-3 bg-white/90 backdrop-blur-sm border-4 border-amber-300 rounded-full px-6 py-2 shadow-md mb-6"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-300 to-yellow-400 border-2 border-amber-500 flex items-center justify-center text-2xl shadow-inner">
            🧸
          </div>
          <span className="text-3xl sm:text-4xl font-black text-[#1D4ED8] tracking-wider uppercase drop-shadow-xs">
            PLAYROOM
          </span>
          <Sparkles className="w-6 h-6 text-amber-500 animate-spin" />
        </motion.div>

        {/* Welcome Headlines */}
        <motion.h1
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="text-4xl sm:text-6xl font-black text-[#1E3A8A] mb-3 tracking-tight drop-shadow-sm"
        >
          Welcome to Playroom!
        </motion.h1>

        <p className="text-xl sm:text-2xl font-bold text-[#0284C7] mb-6 max-w-lg">
          Let's Learn Through Play! 🌟
        </p>

        {/* Authentication or Start Button */}
        {SHOW_GOOGLE_LOGIN && !userAccount?.isLoggedIn ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-md">
            {/* Continue with Google Button */}
            <motion.button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full flex items-center justify-center gap-3.5 bg-white hover:bg-slate-50 text-slate-800 font-black text-lg sm:text-xl px-8 py-4 sm:py-5 rounded-2xl border-4 border-slate-300 border-b-6 border-b-slate-400 shadow-xl active:border-b-2 active:translate-y-1 cursor-pointer transition-all uppercase tracking-wide"
            >
              {/* Google G Logo SVG */}
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
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
              <span>{isLoggingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </motion.button>

            {loginError && (
              <p className="text-xs text-rose-600 font-bold mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                {loginError}
              </p>
            )}

            {/* Direct Quick Start button */}
            <button
              type="button"
              onClick={handleStart}
              className="text-xs font-bold text-blue-900/80 hover:text-blue-950 underline underline-offset-2 transition-colors cursor-pointer mt-1"
            >
              Or preview Playroom activities directly
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Authenticated User Pill (if logged in) */}
            {userAccount?.isLoggedIn && (
              <div className="inline-flex items-center gap-2 bg-white/95 border-2 border-emerald-400 text-emerald-800 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-sm mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Signed in as:</span>
                <span className="font-black text-slate-900">{userAccount.email}</span>
              </div>
            )}

            {/* Play Button */}
            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              animate={{
                scale: [1, 1.04, 1],
                transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
              }}
              className="group relative inline-flex items-center gap-4 bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16A34A] hover:to-[#15803D] text-white font-black text-2xl sm:text-3xl px-10 sm:px-14 py-5 sm:py-6 rounded-3xl border-b-8 border-[#15803D] shadow-2xl active:border-b-2 active:translate-y-2 cursor-pointer transition-all uppercase tracking-wider"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-8 h-8 fill-white text-white translate-x-0.5" />
              </div>
              <span>Start</span>
            </motion.button>
          </div>
        )}

        {/* Speaker Replay Button */}
        <button
          type="button"
          onClick={handleHearWelcome}
          className="mt-6 inline-flex items-center gap-2 bg-white/80 hover:bg-white text-blue-900 font-bold px-4 py-2 rounded-2xl border-2 border-blue-200 shadow-sm text-sm cursor-pointer transition-all"
        >
          <Volume2 className="w-4 h-4 text-blue-600" />
          <span>Listen Again</span>
        </button>

        {/* Bottom decorative banner */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs font-black text-blue-800/80 uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Made for Kids
          </span>
          <span className="hidden sm:inline">•</span>
          <span>Ages 3–6</span>
          <span className="hidden sm:inline">•</span>
          <span>Developed by Ramsha Shaikh</span>
        </div>
      </motion.div>
    </div>
  );
};
